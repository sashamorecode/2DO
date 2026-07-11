package handlers

import (
	"net/http"
	"regexp"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/sasha/2do-backend/internal/middleware"
	"github.com/sasha/2do-backend/internal/models"
	"gorm.io/gorm"
)

type TagHandler struct {
	db *gorm.DB
}

func NewTagHandler(db *gorm.DB) *TagHandler {
	return &TagHandler{db: db}
}

type tagRequest struct {
	Name  string `json:"name" binding:"required,max=40"`
	Color string `json:"color" binding:"required"`
}

var hexColorRegex = regexp.MustCompile(`^#[0-9a-fA-F]{6}$`)

func (h *TagHandler) List(c *gin.Context) {
	userID := middleware.GetUserID(c)
	var tags []models.Tag
	h.db.Where("user_id = ?", userID).Order("name ASC").Find(&tags)
	c.JSON(http.StatusOK, tags)
}

func (h *TagHandler) Create(c *gin.Context) {
	userID := middleware.GetUserID(c)
	var req tagRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	name := strings.TrimSpace(req.Name)
	if name == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "name is required"})
		return
	}
	color := strings.ToUpper(strings.TrimSpace(req.Color))
	if !hexColorRegex.MatchString(color) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "color must be a hex value like #FFAA00"})
		return
	}

	if h.tagNameExists(userID, name, uuid.Nil) {
		c.JSON(http.StatusConflict, gin.H{"error": "tag name already exists"})
		return
	}

	tag := models.Tag{
		UserID: userID,
		Name:   name,
		Color:  color,
	}
	if err := h.db.Create(&tag).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create tag"})
		return
	}
	c.JSON(http.StatusCreated, tag)
}

func (h *TagHandler) Update(c *gin.Context) {
	userID := middleware.GetUserID(c)
	tag, ok := h.findOwned(c, userID)
	if !ok {
		return
	}

	var req tagRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	name := strings.TrimSpace(req.Name)
	if name == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "name is required"})
		return
	}
	color := strings.ToUpper(strings.TrimSpace(req.Color))
	if !hexColorRegex.MatchString(color) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "color must be a hex value like #FFAA00"})
		return
	}

	if h.tagNameExists(userID, name, tag.ID) {
		c.JSON(http.StatusConflict, gin.H{"error": "tag name already exists"})
		return
	}

	tag.Name = name
	tag.Color = color
	if err := h.db.Save(&tag).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update tag"})
		return
	}
	c.JSON(http.StatusOK, tag)
}

func (h *TagHandler) Delete(c *gin.Context) {
	userID := middleware.GetUserID(c)
	tag, ok := h.findOwned(c, userID)
	if !ok {
		return
	}

	if err := h.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("tag_id = ?", tag.ID).Delete(&models.TodoTag{}).Error; err != nil {
			return err
		}
		return tx.Delete(&tag).Error
	}); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to delete tag"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true})
}

func (h *TagHandler) findOwned(c *gin.Context, userID uuid.UUID) (models.Tag, bool) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return models.Tag{}, false
	}
	var tag models.Tag
	if err := h.db.Where("id = ? AND user_id = ?", id, userID).First(&tag).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "tag not found"})
		return models.Tag{}, false
	}
	return tag, true
}

func (h *TagHandler) tagNameExists(userID uuid.UUID, name string, excludeID uuid.UUID) bool {
	q := h.db.Model(&models.Tag{}).
		Where("user_id = ? AND LOWER(name) = LOWER(?)", userID, name)
	if excludeID != uuid.Nil {
		q = q.Where("id <> ?", excludeID)
	}
	var count int64
	q.Count(&count)
	return count > 0
}
