package worker

import (
	"context"
	"log"
	"time"
)

func StartScheduler(ctx context.Context, checker *DeadlineChecker, intervalMinutes int) {
	ticker := time.NewTicker(time.Duration(intervalMinutes) * time.Minute)
	defer ticker.Stop()

	log.Printf("notification worker started, interval=%dm", intervalMinutes)

	// Run once immediately on startup
	checker.Run(ctx)

	for {
		select {
		case <-ticker.C:
			checker.Run(ctx)
		case <-ctx.Done():
			log.Println("notification worker stopped")
			return
		}
	}
}
