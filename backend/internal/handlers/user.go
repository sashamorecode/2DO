package handlers

import (
	"net/http"
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
	c.JSON(http.StatusOK, gin.H{"user": user.ToPublic()})
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
