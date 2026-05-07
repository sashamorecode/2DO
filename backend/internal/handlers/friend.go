package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/sasha/2do-backend/internal/middleware"
	"github.com/sasha/2do-backend/internal/models"
	"gorm.io/gorm"
)

type FriendHandler struct {
	db *gorm.DB
}

func NewFriendHandler(db *gorm.DB) *FriendHandler {
	return &FriendHandler{db: db}
}

func (h *FriendHandler) ListFriends(c *gin.Context) {
	userID := middleware.GetUserID(c)
	var friendships []models.Friendship
	h.db.Preload("Requester").Preload("Addressee").
		Where("(requester_id = ? OR addressee_id = ?) AND status = ?", userID, userID, models.FriendshipAccepted).
		Find(&friendships)

	type friend struct {
		FriendshipID uuid.UUID        `json:"friendship_id"`
		User         models.UserPublic `json:"user"`
	}
	result := make([]friend, 0, len(friendships))
	for _, f := range friendships {
		var u models.UserPublic
		if f.RequesterID == userID {
			u = f.Addressee.ToPublic()
		} else {
			u = f.Requester.ToPublic()
		}
		result = append(result, friend{FriendshipID: f.ID, User: u})
	}
	c.JSON(http.StatusOK, result)
}

func (h *FriendHandler) IncomingRequests(c *gin.Context) {
	userID := middleware.GetUserID(c)
	var friendships []models.Friendship
	h.db.Preload("Requester").
		Where("addressee_id = ? AND status = ?", userID, models.FriendshipPending).
		Find(&friendships)
	c.JSON(http.StatusOK, friendships)
}

func (h *FriendHandler) SentRequests(c *gin.Context) {
	userID := middleware.GetUserID(c)
	var friendships []models.Friendship
	h.db.Preload("Addressee").
		Where("requester_id = ? AND status = ?", userID, models.FriendshipPending).
		Find(&friendships)
	c.JSON(http.StatusOK, friendships)
}

func (h *FriendHandler) SendRequest(c *gin.Context) {
	userID := middleware.GetUserID(c)
	var req struct {
		AddresseeID uuid.UUID `json:"addressee_id" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if req.AddresseeID == userID {
		c.JSON(http.StatusBadRequest, gin.H{"error": "cannot friend yourself"})
		return
	}

	var existing models.Friendship
	err := h.db.Where(
		"(requester_id = ? AND addressee_id = ?) OR (requester_id = ? AND addressee_id = ?)",
		userID, req.AddresseeID, req.AddresseeID, userID,
	).First(&existing).Error
	if err == nil {
		c.JSON(http.StatusConflict, gin.H{"error": "friendship already exists"})
		return
	}

	friendship := models.Friendship{
		RequesterID: userID,
		AddresseeID: req.AddresseeID,
		Status:      models.FriendshipPending,
	}
	if err := h.db.Create(&friendship).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to send request"})
		return
	}
	c.JSON(http.StatusCreated, friendship)
}

func (h *FriendHandler) Accept(c *gin.Context) {
	userID := middleware.GetUserID(c)
	f, ok := h.findAddressed(c, userID)
	if !ok {
		return
	}
	f.Status = models.FriendshipAccepted
	h.db.Save(&f)
	c.JSON(http.StatusOK, f)
}

func (h *FriendHandler) Decline(c *gin.Context) {
	userID := middleware.GetUserID(c)
	f, ok := h.findAddressed(c, userID)
	if !ok {
		return
	}
	f.Status = models.FriendshipDeclined
	h.db.Save(&f)
	c.JSON(http.StatusOK, f)
}

func (h *FriendHandler) Remove(c *gin.Context) {
	userID := middleware.GetUserID(c)
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}
	result := h.db.Where(
		"id = ? AND (requester_id = ? OR addressee_id = ?)", id, userID, userID,
	).Delete(&models.Friendship{})
	if result.RowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "friendship not found"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true})
}

func (h *FriendHandler) findAddressed(c *gin.Context, userID uuid.UUID) (models.Friendship, bool) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return models.Friendship{}, false
	}
	var f models.Friendship
	if err := h.db.Where("id = ? AND addressee_id = ? AND status = ?", id, userID, models.FriendshipPending).First(&f).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "request not found"})
		return models.Friendship{}, false
	}
	return f, true
}
