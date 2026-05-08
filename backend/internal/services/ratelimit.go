package services

import (
	"sync"
	"time"
)

// EmailRateLimiter caps OTP-request frequency per email address.
// In-memory only — fine for a single-instance deployment.
type EmailRateLimiter struct {
	mu      sync.Mutex
	entries map[string]*rateEntry

	cooldown   time.Duration
	hourlyMax  int
	hourWindow time.Duration
}

type rateEntry struct {
	last      time.Time
	hourStart time.Time
	hourCount int
}

func NewEmailRateLimiter() *EmailRateLimiter {
	return &EmailRateLimiter{
		entries:    make(map[string]*rateEntry),
		cooldown:   60 * time.Second,
		hourlyMax:  5,
		hourWindow: time.Hour,
	}
}

// Allow returns true if a request for this email is permitted right now.
// On true, the call is recorded against the limit. On false, the second
// return value is a human-readable reason.
func (r *EmailRateLimiter) Allow(email string) (bool, string) {
	r.mu.Lock()
	defer r.mu.Unlock()

	now := time.Now()
	e, ok := r.entries[email]
	if !ok {
		r.entries[email] = &rateEntry{last: now, hourStart: now, hourCount: 1}
		return true, ""
	}

	if now.Sub(e.last) < r.cooldown {
		return false, "Please wait a minute before requesting another code"
	}
	if now.Sub(e.hourStart) >= r.hourWindow {
		e.hourStart = now
		e.hourCount = 0
	}
	if e.hourCount >= r.hourlyMax {
		return false, "Too many code requests for this email. Try again later"
	}

	e.last = now
	e.hourCount++
	return true, ""
}
