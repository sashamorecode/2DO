package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/sasha/2do-backend/internal/config"
	"github.com/sasha/2do-backend/internal/db"
	"github.com/sasha/2do-backend/internal/router"
	"github.com/sasha/2do-backend/internal/services"
	"github.com/sasha/2do-backend/internal/worker"
)

func main() {
	cfg := config.Load()

	database := db.Connect(cfg.DatabaseURL)

	r := router.Setup(database, cfg.JWTSecret)

	notifSvc := services.NewNotificationService(cfg.ExpoAccessToken)
	checker := worker.NewDeadlineChecker(database, notifSvc)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	go worker.StartScheduler(ctx, checker, cfg.WorkerIntervalMinutes)

	srv := &http.Server{
		Addr:    ":" + cfg.Port,
		Handler: r,
	}

	go func() {
		log.Printf("server listening on :%s", cfg.Port)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("server error: %v", err)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Println("shutting down...")
	cancel()

	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer shutdownCancel()
	if err := srv.Shutdown(shutdownCtx); err != nil {
		log.Printf("shutdown error: %v", err)
	}
}
