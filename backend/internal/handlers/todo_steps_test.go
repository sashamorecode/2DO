package handlers

import (
	"encoding/json"
	"os"
	"strings"
	"testing"

	"github.com/google/uuid"
	"github.com/sasha/2do-backend/internal/models"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

// Run against PostgreSQL with TODO_STEPS_TEST_DSN set. All schema and data
// changes are isolated in a transaction that is rolled back after the test.
func TestReplaceTodoStepsPersistence(t *testing.T) {
	dsn := os.Getenv("TODO_STEPS_TEST_DSN")
	if dsn == "" {
		t.Skip("TODO_STEPS_TEST_DSN is not set")
	}
	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	if err != nil {
		t.Fatal(err)
	}
	sqlDB, err := db.DB()
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { sqlDB.Close() })
	tx := db.Begin()
	if tx.Error != nil {
		t.Fatal(tx.Error)
	}
	t.Cleanup(func() { tx.Rollback() })
	schema := "todo_steps_test_" + strings.ReplaceAll(uuid.NewString(), "-", "")
	if err := tx.Exec("CREATE SCHEMA " + schema).Error; err != nil {
		t.Fatal(err)
	}
	if err := tx.Exec("SET LOCAL search_path TO " + schema).Error; err != nil {
		t.Fatal(err)
	}
	if err := tx.AutoMigrate(&models.User{}, &models.Tag{}, &models.Todo{}, &models.TodoStep{}); err != nil {
		t.Fatal(err)
	}

	user := models.User{Email: "steps@example.com"}
	if err := tx.Create(&user).Error; err != nil {
		t.Fatal(err)
	}
	todo := models.Todo{UserID: user.ID, Title: "With steps", Priority: models.PriorityA}
	other := models.Todo{UserID: user.ID, Title: "Other todo", Priority: models.PriorityB}
	for _, item := range []*models.Todo{&todo, &other} {
		if err := tx.Create(item).Error; err != nil {
			t.Fatal(err)
		}
		if item.Steps == nil {
			t.Fatal("fresh todo steps must be an empty slice")
		}
	}

	load := func(id uuid.UUID) models.Todo {
		t.Helper()
		var item models.Todo
		if err := tx.Preload("Steps", orderTodoSteps).First(&item, "id = ?", id).Error; err != nil {
			t.Fatal(err)
		}
		return item
	}
	replace := func(id uuid.UUID, inputs *[]stepInput) {
		t.Helper()
		if err := tx.Transaction(func(write *gorm.DB) error {
			return replaceTodoSteps(write, id, inputs)
		}); err != nil {
			t.Fatal(err)
		}
	}
	otherInputs := []stepInput{{Name: "Other step"}}
	replace(other.ID, &otherInputs)
	inputs := []stepInput{{Name: "  First step \n", Completed: true}, {Name: " \t\n "}}
	replace(todo.ID, &inputs)
	loaded := load(todo.ID)
	if len(loaded.Steps) != 2 || loaded.Steps[0].Name != "First step" || loaded.Steps[1].Name != "" {
		t.Fatalf("trimmed and blank steps must be retained: %+v", loaded.Steps)
	}
	if !loaded.Steps[0].Completed || loaded.Steps[1].Completed {
		t.Fatalf("completion states not persisted: %+v", loaded.Steps)
	}
	for position, step := range loaded.Steps {
		if step.ID == uuid.Nil || step.TodoID != todo.ID || step.Position != position || step.CreatedAt.IsZero() || step.UpdatedAt.IsZero() {
			t.Fatalf("incorrect persisted step: %+v", step)
		}
		data, err := json.Marshal(step)
		if err != nil {
			t.Fatal(err)
		}
		var fields map[string]json.RawMessage
		if err := json.Unmarshal(data, &fields); err != nil {
			t.Fatal(err)
		}
		if len(fields) != 4 || fields["id"] == nil || fields["name"] == nil || fields["completed"] == nil || fields["position"] == nil {
			t.Fatalf("unexpected step JSON fields: %s", data)
		}
	}

	// An omitted replacement must not even access the database.
	if err := replaceTodoSteps(nil, todo.ID, nil); err != nil {
		t.Fatal(err)
	}
	replace(todo.ID, nil)
	if preserved := load(todo.ID); len(preserved.Steps) != 2 || preserved.Steps[0].ID != loaded.Steps[0].ID {
		t.Fatalf("omitted steps changed existing rows: %+v", preserved.Steps)
	}

	// A failed insert after deletion must restore the original rows through
	// the caller's transaction, rather than leaving the todo without steps.
	invalid := []stepInput{{Name: strings.Repeat("x", 256)}}
	if err := tx.Transaction(func(write *gorm.DB) error {
		return replaceTodoSteps(write, todo.ID, &invalid)
	}); err == nil {
		t.Fatal("expected PostgreSQL to reject an oversized step name")
	}
	if preserved := load(todo.ID); len(preserved.Steps) != 2 || preserved.Steps[0].ID != loaded.Steps[0].ID {
		t.Fatalf("failed replacement did not roll back: %+v", preserved.Steps)
	}

	empty := []stepInput{}
	replace(todo.ID, &empty)
	// loaded still has old steps; saving other todo fields must not recreate
	// them after a replacement cleared them.
	loaded.Title = "Updated title"
	if err := tx.Omit("Steps").Save(&loaded).Error; err != nil {
		t.Fatal(err)
	}
	cleared := load(todo.ID)
	if cleared.Steps == nil || len(cleared.Steps) != 0 {
		t.Fatalf("empty replacement must return an empty slice: %+v", cleared.Steps)
	}
	data, err := json.Marshal(cleared)
	if err != nil {
		t.Fatal(err)
	}
	var fields map[string]json.RawMessage
	if err := json.Unmarshal(data, &fields); err != nil {
		t.Fatal(err)
	}
	if string(fields["steps"]) != "[]" {
		t.Fatalf("empty todo steps JSON must be []: %s", data)
	}
	if unaffected := load(other.ID); len(unaffected.Steps) != 1 || unaffected.Steps[0].Name != "Other step" {
		t.Fatalf("replacement touched another todo: %+v", unaffected.Steps)
	}
	if err := tx.Delete(&other).Error; err != nil {
		t.Fatal(err)
	}
	var count int64
	if err := tx.Model(&models.TodoStep{}).Where("todo_id = ?", other.ID).Count(&count).Error; err != nil {
		t.Fatal(err)
	}
	if count != 0 {
		t.Fatalf("todo deletion did not cascade to steps: %d rows remain", count)
	}
}
