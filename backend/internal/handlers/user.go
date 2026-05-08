package handlers

import (
	"errors"
	"net/http"
	"regexp"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/sasha/2do-backend/internal/middleware"
	"github.com/sasha/2do-backend/internal/models"
	"gorm.io/gorm"
)

type UserHandler struct {
	db *gorm.DB
}

func NewUserHandler(db *gorm.DB) *UserHandler {
	return &UserHandler{db: db}
}

func (h *UserHandler) Me(c *gin.Context) {
	userID := middleware.GetUserID(c)
	var user models.User
	if err := h.db.First(&user, "id = ?", userID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"user": user.ToMe()})
}

var usernameRegex = regexp.MustCompile(`^[a-zA-Z0-9_]+$`)

type updateMeRequest struct {
	Username *string `json:"username"`
	Timezone *string `json:"timezone"`
}

func (h *UserHandler) UpdateMe(c *gin.Context) {
	userID := middleware.GetUserID(c)
	var req updateMeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	updates := map[string]interface{}{}

	if req.Username != nil {
		username := strings.TrimSpace(*req.Username)
		if len(username) < 3 || len(username) > 50 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "username must be 3-50 characters"})
			return
		}
		if !usernameRegex.MatchString(username) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "username may only contain letters, digits, and underscores"})
			return
		}

		var clash models.User
		err := h.db.Where("username = ? AND id <> ?", username, userID).First(&clash).Error
		if err == nil {
			c.JSON(http.StatusConflict, gin.H{"error": "username already taken"})
			return
		}
		if !errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to check username"})
			return
		}
		updates["username"] = username
	}

	if req.Timezone != nil {
		tz := strings.TrimSpace(*req.Timezone)
		if _, err := time.LoadLocation(tz); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid timezone"})
			return
		}
		updates["timezone"] = tz
	}

	if len(updates) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "no fields to update"})
		return
	}

	if err := h.db.Model(&models.User{}).Where("id = ?", userID).Updates(updates).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update profile"})
		return
	}

	var user models.User
	if err := h.db.First(&user, "id = ?", userID).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load user"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"user": user.ToMe()})
}

func (h *UserHandler) UpdatePushToken(c *gin.Context) {
	userID := middleware.GetUserID(c)
	var req struct {
		Token string `json:"token" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	now := time.Now()
	if err := h.db.Model(&models.User{}).Where("id = ?", userID).Updates(map[string]interface{}{
		"push_token":            req.Token,
		"push_token_updated_at": now,
	}).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update push token"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true})
}

func (h *UserHandler) SearchUsers(c *gin.Context) {
	q := c.Query("q")
	if q == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "q parameter required"})
		return
	}
	var users []models.User
	h.db.Where("username ILIKE ?", "%"+q+"%").Limit(20).Find(&users)
	result := make([]models.UserPublic, len(users))
	for i, u := range users {
		result[i] = u.ToPublic()
	}
	c.JSON(http.StatusOK, result)
}
