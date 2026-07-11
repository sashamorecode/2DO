package handlers

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/sasha/2do-backend/internal/middleware"
	"github.com/sasha/2do-backend/internal/models"
	"github.com/sasha/2do-backend/internal/services"
	"gorm.io/gorm"
)

type BodyDoubleHandler struct {
	db    *gorm.DB
	notif *services.NotificationService
}

func NewBodyDoubleHandler(db *gorm.DB, notif *services.NotificationService) *BodyDoubleHandler {
	return &BodyDoubleHandler{db: db, notif: notif}
}

type createSessionRequest struct {
	TodoID      *uuid.UUID  `json:"todo_id"`
	InviteeIDs  []uuid.UUID `json:"invitee_ids" binding:"required,min=1"`
	Message     *string     `json:"message"`
	ScheduledAt time.Time   `json:"scheduled_at" binding:"required"`
}

func (h *BodyDoubleHandler) CreateSession(c *gin.Context) {
	userID := middleware.GetUserID(c)

	var req createSessionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Validate all invitees are accepted friends (single query)
	for _, inviteeID := range req.InviteeIDs {
		if inviteeID == userID {
			c.JSON(http.StatusBadRequest, gin.H{"error": "cannot invite yourself"})
			return
		}
	}
	var friendCount int64
	h.db.Model(&models.Friendship{}).
		Where("status = ? AND ((requester_id = ? AND addressee_id IN ?) OR (requester_id IN ? AND addressee_id = ?))",
			models.FriendshipAccepted, userID, req.InviteeIDs, req.InviteeIDs, userID).
		Count(&friendCount)
	if int(friendCount) != len(req.InviteeIDs) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "all invitees must be accepted friends"})
		return
	}

	// Use transaction for session + invitations + optional todo update
	var session models.BodyDoubleSession
	var todoTitle string
	err := h.db.Transaction(func(tx *gorm.DB) error {
		session = models.BodyDoubleSession{
			RequesterID: userID,
			TodoID:      req.TodoID,
			Message:     req.Message,
			ScheduledAt: req.ScheduledAt,
		}
		if err := tx.Create(&session).Error; err != nil {
			return err
		}

		for _, inviteeID := range req.InviteeIDs {
			invitation := models.BodyDoubleInvitation{
				SessionID: session.ID,
				InviteeID: inviteeID,
				Status:    models.BodyDoublePending,
			}
			if err := tx.Create(&invitation).Error; err != nil {
				return err
			}
		}

		// If scheduled_at differs from todo's planned_at, update the todo
		if req.TodoID != nil {
			var todo models.Todo
			if err := tx.Where("id = ? AND user_id = ?", req.TodoID, userID).First(&todo).Error; err != nil {
				return err
			}
			todoTitle = todo.Title
			if todo.PlannedAt == nil || !todo.PlannedAt.Equal(req.ScheduledAt) {
				todo.PlannedAt = &req.ScheduledAt
				if err := tx.Save(&todo).Error; err != nil {
					return err
				}
			}
		}

		return nil
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create session"})
		return
	}

	// Load invitations and requester for response
	var invitations []models.BodyDoubleInvitation
	h.db.Preload("Invitee").Where("session_id = ?", session.ID).Find(&invitations)
	session.Invitations = invitations
	h.db.Preload("Requester").First(&session, session.ID)

	// Send push notifications to all invitees (best-effort)
	for _, inv := range invitations {
		if inv.Invitee != nil && inv.Invitee.PushToken != nil && *inv.Invitee.PushToken != "" {
			title := todoTitle
			if title == "" {
				title = "a focus session"
			}
			username := "Someone"
			if session.Requester != nil && session.Requester.Username != nil {
				username = *session.Requester.Username
			}
			_ = h.notif.SendBodyDoubleInvite(*inv.Invitee.PushToken, username, title, session.ScheduledAt)
		}
	}

	c.JSON(http.StatusCreated, session)
}

func (h *BodyDoubleHandler) ListSessions(c *gin.Context) {
	userID := middleware.GetUserID(c)
	role := c.Query("role") // "requester" or "invitee" or empty for both

	var sessions []models.BodyDoubleSession
	query := h.db.Preload("Requester").Preload("Todo")

	if role == "requester" {
		query = query.Where("requester_id = ?", userID)
	} else if role == "invitee" {
		query = query.Where("id IN (SELECT session_id FROM body_double_invitations WHERE invitee_id = ?)", userID)
	} else {
		query = query.Where("requester_id = ? OR id IN (SELECT session_id FROM body_double_invitations WHERE invitee_id = ?)", userID, userID)
	}

	query.Order("scheduled_at DESC").Find(&sessions)

	// Batch-load invitations for all sessions (single query)
	if len(sessions) > 0 {
		sessionIDs := make([]uuid.UUID, len(sessions))
		for i := range sessions {
			sessionIDs[i] = sessions[i].ID
		}
		var allInvs []models.BodyDoubleInvitation
		h.db.Preload("Invitee").Where("session_id IN ?", sessionIDs).Find(&allInvs)

		bySession := make(map[uuid.UUID][]models.BodyDoubleInvitation, len(sessions))
		for _, inv := range allInvs {
			bySession[inv.SessionID] = append(bySession[inv.SessionID], inv)
		}
		for i := range sessions {
			sessions[i].Invitations = bySession[sessions[i].ID]
		}
	}

	c.JSON(http.StatusOK, sessions)
}

func (h *BodyDoubleHandler) GetSession(c *gin.Context) {
	userID := middleware.GetUserID(c)
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}

	var session models.BodyDoubleSession
	if err := h.db.Preload("Requester").Preload("Todo").
		Where("id = ? AND (requester_id = ? OR id IN (SELECT session_id FROM body_double_invitations WHERE invitee_id = ?))",
			id, userID, userID).
		First(&session).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "session not found"})
		return
	}

	var invitations []models.BodyDoubleInvitation
	h.db.Preload("Invitee").Where("session_id = ?", session.ID).Find(&invitations)
	session.Invitations = invitations

	c.JSON(http.StatusOK, session)
}

type respondRequest struct {
	Status models.BodyDoubleStatus `json:"status" binding:"required,oneof=accepted maybe declined"`
}

type respondResponse struct {
	models.BodyDoubleInvitation
	CreatedTodo *models.Todo `json:"created_todo,omitempty"`
}

func (h *BodyDoubleHandler) RespondToInvitation(c *gin.Context) {
	userID := middleware.GetUserID(c)

	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}

	var req respondRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var invitation models.BodyDoubleInvitation
	if err := h.db.Preload("Session").Preload("Session.Requester").Preload("Session.Todo").Preload("Invitee").
		Where("id = ? AND invitee_id = ? AND status = ?", id, userID, models.BodyDoublePending).
		First(&invitation).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "invitation not found"})
		return
	}

	var createdTodo *models.Todo
	isPositiveResponse := req.Status == models.BodyDoubleAccepted || req.Status == models.BodyDoubleMaybe

	err = h.db.Transaction(func(tx *gorm.DB) error {
		invitation.Status = req.Status
		if err := tx.Save(&invitation).Error; err != nil {
			return err
		}

		// If accepted or maybe, create a task for the invitee
		if isPositiveResponse {
			username := "Someone"
			if invitation.Session.Requester != nil && invitation.Session.Requester.Username != nil {
				username = *invitation.Session.Requester.Username
			}
			title := "Body Doubling Session with " + username
			todo := models.Todo{
				UserID:     userID,
				Title:      title,
				Priority:   models.PriorityB,
				PlannedAt:  &invitation.Session.ScheduledAt,
				IsPrivate:  true,
				Status:     models.StatusPending,
			}
			if err := tx.Create(&todo).Error; err != nil {
				return err
			}
			createdTodo = &todo
		}

		return nil
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to respond to invitation"})
		return
	}

	// Notify requester of response (before clearing tokens for the response)
	if isPositiveResponse && invitation.Session.Requester != nil && invitation.Session.Requester.PushToken != nil && *invitation.Session.Requester.PushToken != "" {
		respUsername := "Someone"
		if invitation.Invitee != nil && invitation.Invitee.Username != nil {
			respUsername = *invitation.Invitee.Username
		}
		_ = h.notif.SendBodyDoubleResponse(*invitation.Session.Requester.PushToken, respUsername, string(req.Status))
	}

	// Clear push tokens before serialization — never leak them to other users
	if invitation.Invitee != nil {
		invitation.Invitee.PushToken = nil
	}
	if invitation.Session != nil && invitation.Session.Requester != nil {
		invitation.Session.Requester.PushToken = nil
	}

	c.JSON(http.StatusOK, respondResponse{
		BodyDoubleInvitation: invitation,
		CreatedTodo:          createdTodo,
	})
}
