package router

import (
	"github.com/gin-gonic/gin"
	"github.com/sasha/2do-backend/internal/config"
	"github.com/sasha/2do-backend/internal/handlers"
	"github.com/sasha/2do-backend/internal/middleware"
	"github.com/sasha/2do-backend/internal/services"
	"gorm.io/gorm"
)

func Setup(db *gorm.DB, cfg *config.Config) *gin.Engine {
	r := gin.Default()
	r.Use(middleware.CORS())

	emailSvc := services.NewEmailService(cfg.ResendAPIKey, cfg.EmailFrom)
	rateLimiter := services.NewEmailRateLimiter()

	authH := handlers.NewAuthHandler(db, cfg.JWTSecret, cfg.GoogleClientIDs, emailSvc, rateLimiter)
	userH := handlers.NewUserHandler(db)
	todoH := handlers.NewTodoHandler(db)
	friendH := handlers.NewFriendHandler(db)
	feedH := handlers.NewFeedHandler(db)

	r.GET("/health", func(c *gin.Context) { c.Status(200) })

	v1 := r.Group("/api/v1")

	// Public
	auth := v1.Group("/auth")
	auth.POST("/google", authH.Google)
	auth.POST("/email/start", authH.EmailStart)
	auth.POST("/email/verify", authH.EmailVerify)

	// Protected
	protected := v1.Group("")
	protected.Use(middleware.Auth(cfg.JWTSecret))

	protected.GET("/me", userH.Me)
	protected.PATCH("/me", userH.UpdateMe)
	protected.PUT("/me/push-token", userH.UpdatePushToken)
	protected.GET("/users/search", userH.SearchUsers)

	todos := protected.Group("/todos")
	todos.GET("", todoH.List)
	todos.POST("", todoH.Create)
	todos.GET("/:id", todoH.Get)
	todos.PUT("/:id", todoH.Update)
	todos.DELETE("/:id", todoH.Delete)
	todos.PATCH("/:id/complete", todoH.Complete)
	todos.PATCH("/:id/reopen", todoH.Reopen)

	friends := protected.Group("/friends")
	friends.GET("", friendH.ListFriends)
	friends.GET("/requests", friendH.IncomingRequests)
	friends.GET("/sent", friendH.SentRequests)
	friends.POST("/request", friendH.SendRequest)
	friends.PATCH("/:id/accept", friendH.Accept)
	friends.PATCH("/:id/decline", friendH.Decline)
	friends.DELETE("/:id", friendH.Remove)

	protected.GET("/feed", feedH.GetFeed)

	return r
}
