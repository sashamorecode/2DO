package services

import (
	"fmt"
	"log"
	"math/rand"

	expo "github.com/oliveroneill/exponent-server-sdk-golang/sdk"
)

type NotificationService struct {
	client *expo.PushClient
}

var pokeNotificationTemplates = []string{
	"Hi there! %s is reminding you to do %q.",
	"Tiny nudge incoming: %s is cheering you on to finish %q.",
	"Poke poke. %s thinks now might be a sweet time to do %q.",
	"A cute reminder from %s: %q is waiting for you.",
	"Just a lil tap from %s to say: you've got %q.",
}

func NewNotificationService(accessToken string) *NotificationService {
	var cfg *expo.ClientConfig
	if accessToken != "" {
		cfg = &expo.ClientConfig{AccessToken: accessToken}
	}
	return &NotificationService{client: expo.NewPushClient(cfg)}
}

func (s *NotificationService) SendWarning6h(pushToken, todoTitle string) error {
	return s.send(pushToken, "⏰ Heads Up!", fmt.Sprintf("Your friends will be notified if \"%s\" isn't done in 6 hours", todoTitle))
}

func (s *NotificationService) SendDeadlineMissedToOwner(pushToken, todoTitle string) error {
	return s.send(pushToken, "😬 Deadline Missed", fmt.Sprintf("You missed your deadline on \"%s\" — your friends have been notified", todoTitle))
}

func (s *NotificationService) SendDeadlineMissedToFriend(pushToken, ownerUsername, todoTitle string) error {
	return s.send(pushToken, "👀 Accountability Check", fmt.Sprintf("%s missed their deadline on \"%s\"", ownerUsername, todoTitle))
}

func (s *NotificationService) SendDoDateMissed(pushToken, todoTitle string) error {
	return s.send(
		pushToken,
		"⏰ Time to do it",
		fmt.Sprintf("Your do date for \"%s\" has passed. Your friends will be notified in 24 hours unless you finish it.", todoTitle),
	)
}

func (s *NotificationService) SendDueDateMissed(pushToken, todoTitle string) error {
	return s.send(
		pushToken,
		"📌 Past due",
		fmt.Sprintf("\"%s\" is past its due date. Your friends will be notified in 24 hours unless you finish it.", todoTitle),
	)
}

func (s *NotificationService) SendDoDateInterventionToFriend(pushToken, ownerUsername, todoTitle string) error {
	return s.send(
		pushToken,
		"🤝 Intervention time",
		fmt.Sprintf("%s's do date for \"%s\" passed 24h ago — give them a nudge.", ownerUsername, todoTitle),
	)
}

func (s *NotificationService) SendDueDateInterventionToFriend(pushToken, ownerUsername, todoTitle string) error {
	return s.send(
		pushToken,
		"🤝 Intervention time",
		fmt.Sprintf("%s's due date for \"%s\" passed 24h ago — give them a nudge.", ownerUsername, todoTitle),
	)
}

func (s *NotificationService) SendTaskPoke(pushToken, fromUsername, todoTitle string) error {
	return s.send(
		pushToken,
		"A friend poked your task",
		fmt.Sprintf(randomPokeTemplate(), fromUsername, todoTitle),
	)
}

func randomPokeTemplate() string {
	return pokeNotificationTemplates[rand.Intn(len(pokeNotificationTemplates))]
}

func (s *NotificationService) send(pushToken, title, body string) error {
	if pushToken == "" {
		return nil
	}

	token, err := expo.NewExponentPushToken(pushToken)
	if err != nil {
		log.Printf("invalid push token %q: %v", pushToken, err)
		return nil
	}

	resp, err := s.client.Publish(&expo.PushMessage{
		To:    []expo.ExponentPushToken{token},
		Title: title,
		Body:  body,
		Sound: "default",
	})
	if err != nil {
		return fmt.Errorf("expo publish error: %w", err)
	}

	if err := resp.ValidateResponse(); err != nil {
		log.Printf("expo push response error for token %s: %v", pushToken, err)
	}

	return nil
}
