package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/sasha/2do-backend/internal/middleware"
	"github.com/sasha/2do-backend/internal/models"
	"gorm.io/gorm"
)

type FeedHandler struct {
	db *gorm.DB
}

func NewFeedHandler(db *gorm.DB) *FeedHandler {
	return &FeedHandler{db: db}
}

type FriendFeedItem struct {
	User  models.UserPublic `json:"user"`
	Todos []models.Todo     `json:"todos"`
}

func (h *FeedHandler) GetFeed(c *gin.Context) {
	userID := middleware.GetUserID(c)

	// Gather accepted friend IDs
	var friendships []models.Friendship
	h.db.Where(
		"(requester_id = ? OR addressee_id = ?) AND status = ?",
		userID, userID, models.FriendshipAccepted,
	).Find(&friendships)

	if len(friendships) == 0 {
		c.JSON(http.StatusOK, []FriendFeedItem{})
		return
	}

	friendIDs := make([]uuid.UUID, 0, len(friendships))
	for _, f := range friendships {
		if f.RequesterID == userID {
			friendIDs = append(friendIDs, f.AddresseeID)
		} else {
			friendIDs = append(friendIDs, f.RequesterID)
		}
	}

	// Optional filter to a single friend
	if fid := c.Query("friend_id"); fid != "" {
		if parsed, err := uuid.Parse(fid); err == nil {
			filtered := []uuid.UUID{}
			for _, id := range friendIDs {
				if id == parsed {
					filtered = append(filtered, id)
				}
			}
			friendIDs = filtered
		}
	}

	// Load friends' pending, non-private todos
	var todos []models.Todo
	h.db.Preload("User").
		Where("user_id IN ? AND status = ? AND is_private = ?", friendIDs, models.StatusPending, false).
		Order("CASE priority WHEN 'A' THEN 1 WHEN 'B' THEN 2 ELSE 3 END, deadline ASC NULLS LAST").
		Find(&todos)

	// Group by friend
	grouped := map[uuid.UUID]*FriendFeedItem{}
	for _, t := range todos {
		if _, ok := grouped[t.UserID]; !ok {
			grouped[t.UserID] = &FriendFeedItem{
				User:  t.User.ToPublic(),
				Todos: []models.Todo{},
			}
		}
		t.User = nil // don't nest user inside each todo
		grouped[t.UserID].Todos = append(grouped[t.UserID].Todos, t)
	}

	// Include friends with zero pending todos too
	var friendUsers []models.User
	h.db.Where("id IN ?", friendIDs).Find(&friendUsers)
	for _, u := range friendUsers {
		if _, ok := grouped[u.ID]; !ok {
			grouped[u.ID] = &FriendFeedItem{User: u.ToPublic(), Todos: []models.Todo{}}
		}
	}

	result := make([]FriendFeedItem, 0, len(grouped))
	for _, item := range grouped {
		result = append(result, *item)
	}
	c.JSON(http.StatusOK, result)
}
