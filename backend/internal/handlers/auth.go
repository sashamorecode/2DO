package handlers

import (
	"errors"
	"log"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/sasha/2do-backend/internal/services"
	"gorm.io/gorm"
)

type AuthHandler struct {
	db          *gorm.DB
	jwtSecret   string
	googleAuds  []string
	emailSvc    *services.EmailService
	rateLimiter *services.EmailRateLimiter
	devMode     bool
}

func NewAuthHandler(
	db *gorm.DB,
	jwtSecret string,
	googleAuds []string,
	emailSvc *services.EmailService,
	rateLimiter *services.EmailRateLimiter,
	devMode bool,
) *AuthHandler {
	return &AuthHandler{
		db:          db,
		jwtSecret:   jwtSecret,
		googleAuds:  googleAuds,
		emailSvc:    emailSvc,
		rateLimiter: rateLimiter,
		devMode:     devMode,
	}
}

type googleAuthRequest struct {
	IDToken string `json:"id_token" binding:"required"`
}

func (h *AuthHandler) Google(c *gin.Context) {
	var req googleAuthRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ident, err := services.VerifyGoogleIDToken(c.Request.Context(), req.IDToken, h.googleAuds)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
		return
	}

	user, err := services.FindOrCreateByGoogle(h.db, ident)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to resolve user"})
		return
	}

	token, err := services.GenerateToken(user.ID, h.jwtSecret)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to generate token"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"token": token, "user": user.ToMe()})
}

type emailStartRequest struct {
	Email string `json:"email" binding:"required,email"`
}

func (h *AuthHandler) EmailStart(c *gin.Context) {
	var req emailStartRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	email := strings.ToLower(strings.TrimSpace(req.Email))

	if ok, reason := h.rateLimiter.Allow(email); !ok {
		c.JSON(http.StatusTooManyRequests, gin.H{"error": reason})
		return
	}

	code, err := services.IssueEmailOTP(h.db, email)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to issue code"})
		return
	}

	if h.devMode {
		log.Printf("OTP for %s: %s", email, code)
		c.JSON(http.StatusOK, gin.H{"ok": true, "code": code})
		return
	}

	if err := h.emailSvc.SendOTP(email, code); err != nil {
		log.Printf("send OTP failed for %s: %v", email, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to send code"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"ok": true})
}

type emailVerifyRequest struct {
	Email string `json:"email" binding:"required,email"`
	Code  string `json:"code" binding:"required,len=6"`
}

type devLoginRequest struct {
	Email string `json:"email"`
}

func (h *AuthHandler) DevLogin(c *gin.Context) {
	if !h.devMode {
		c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
		return
	}

	var req devLoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		req.Email = ""
	}
	email := strings.ToLower(strings.TrimSpace(req.Email))
	if email == "" {
		email = "dev@2do.local"
	}

	user, err := services.FindOrCreateByEmail(h.db, email)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to resolve user"})
		return
	}

	token, err := services.GenerateToken(user.ID, h.jwtSecret)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to generate token"})
		return
	}

	log.Printf("dev login: %s (user %s)", email, user.ID)
	c.JSON(http.StatusOK, gin.H{"token": token, "user": user.ToMe()})
}

func (h *AuthHandler) EmailVerify(c *gin.Context) {
	var req emailVerifyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	email := strings.ToLower(strings.TrimSpace(req.Email))

	if err := services.VerifyEmailOTP(h.db, email, req.Code); err != nil {
		switch {
		case errors.Is(err, services.ErrOTPInvalid):
			c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid or expired code"})
		case errors.Is(err, services.ErrOTPTooMany):
			c.JSON(http.StatusTooManyRequests, gin.H{"error": "too many attempts; request a new code"})
		default:
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to verify code"})
		}
		return
	}

	user, err := services.FindOrCreateByEmail(h.db, email)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to resolve user"})
		return
	}

	token, err := services.GenerateToken(user.ID, h.jwtSecret)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to generate token"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"token": token, "user": user.ToMe()})
}
