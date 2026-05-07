package router

import (
	"github.com/gin-gonic/gin"
	"github.com/sasha/2do-backend/internal/handlers"
	"github.com/sasha/2do-backend/internal/middleware"
	"gorm.io/gorm"
)

func Setup(db *gorm.DB, jwtSecret string) *gin.Engine {
	r := gin.Default()
	r.Use(middleware.CORS())

	authH := handlers.NewAuthHandler(db, jwtSecret)
	userH := handlers.NewUserHandler(db)
	todoH := handlers.NewTodoHandler(db)
	friendH := handlers.NewFriendHandler(db)
	feedH := handlers.NewFeedHandler(db)

	r.GET("/health", func(c *gin.Context) { c.Status(200) })

	v1 := r.Group("/api/v1")

	// Public
	auth := v1.Group("/auth")
	auth.POST("/register", authH.Register)
	auth.POST("/login", authH.Login)

	// Protected
	protected := v1.Group("")
	protected.Use(middleware.Auth(jwtSecret))

	protected.GET("/me", userH.Me)
	protected.PUT("/me/push-token", userH.UpdatePushToken)
	protected.GET("/users/search", userH.SearchUsers)

	todos := protected.Group("/todos")
	todos.GET("", todoH.List)
	todos.POST("", todoH.Create)
	todos.GET("/:id", todoH.Get)
	todos.PUT("/:id", todoH.Update)
	todos.DELETE("/:id", todoH.Delete)
	todos.PATCH("/:id/complete", todoH.Complete)

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
