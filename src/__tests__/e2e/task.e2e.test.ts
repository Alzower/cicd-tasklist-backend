import { describe, it, expect, beforeEach, afterEach, afterAll } from "vitest";
import { vi } from "vitest";
import testPrisma from "./setup.js";

vi.mock("../../lib/prisma.js", () => ({
  default: testPrisma,
}));

const { default: app } = await import("../../app.js");
import request from "supertest";

describe("Task API E2E Tests", () => {
  beforeEach(async () => {
    await testPrisma.task.deleteMany();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    await testPrisma.$disconnect();
  });

  describe("POST /api/tasks", () => {
    it("should create a new task", async () => {
      const res = await request(app)
        .post("/api/tasks")
        .send({ title: "E2E Task", description: "E2E Description" });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty("id");
      expect(res.body.title).toBe("E2E Task");
      expect(res.body.description).toBe("E2E Description");
      expect(res.body.completed).toBe(false);
    });

    it("should create task without description", async () => {
      const res = await request(app)
        .post("/api/tasks")
        .send({ title: "No Description Task" });

      expect(res.status).toBe(201);
      expect(res.body.title).toBe("No Description Task");
      expect(res.body.description).toBeNull();
    });

    it("should return 400 when title is missing", async () => {
      const res = await request(app)
        .post("/api/tasks")
        .send({ description: "No title" });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty("error");
    });

    it("should return 400 when title is empty", async () => {
      const res = await request(app).post("/api/tasks").send({ title: "   " });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty("error");
    });
  });

  describe("GET /api/tasks", () => {
    it("should return empty array when no tasks", async () => {
      const res = await request(app).get("/api/tasks");

      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it("should return all tasks", async () => {
      await testPrisma.task.create({ data: { title: "Task 1" } });
      await testPrisma.task.create({ data: { title: "Task 2" } });

      const res = await request(app).get("/api/tasks");

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
    });

    it("should return tasks ordered by createdAt desc", async () => {
      await testPrisma.task.create({ data: { title: "First Task" } });
      await testPrisma.task.create({ data: { title: "Second Task" } });

      const res = await request(app).get("/api/tasks");

      expect(res.status).toBe(200);
      expect(res.body[0].title).toBe("First Task");
      expect(res.body[1].title).toBe("Second Task");
    });
  });

  describe("GET /api/tasks/:id", () => {
    it("should return task by id", async () => {
      const task = await testPrisma.task.create({ data: { title: "Find Me" } });

      const res = await request(app).get(`/api/tasks/${task.id}`);

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(task.id);
      expect(res.body.title).toBe("Find Me");
    });

    it("should return 404 when task not found", async () => {
      const res = await request(app).get("/api/tasks/99999");

      expect(res.status).toBe(404);
      expect(res.body).toHaveProperty("error");
    });

    it("should return 400 when id is invalid", async () => {
      const res = await request(app).get("/api/tasks/abc");

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty("error");
    });
  });

  describe("PUT /api/tasks/:id", () => {
    it("should update task title", async () => {
      const task = await testPrisma.task.create({
        data: { title: "Old Title" },
      });

      const res = await request(app)
        .put(`/api/tasks/${task.id}`)
        .send({ title: "New Title" });

      expect(res.status).toBe(200);
      expect(res.body.title).toBe("New Title");
    });

    it("should mark task as completed", async () => {
      const task = await testPrisma.task.create({ data: { title: "Task" } });

      const res = await request(app)
        .put(`/api/tasks/${task.id}`)
        .send({ completed: true });

      expect(res.status).toBe(200);
      expect(res.body.completed).toBe(true);
    });

    it("should return 404 when task not found", async () => {
      const res = await request(app)
        .put("/api/tasks/99999")
        .send({ title: "Updated" });

      expect(res.status).toBe(404);
      expect(res.body).toHaveProperty("error");
    });

    it("should return 400 when id is invalid", async () => {
      const res = await request(app)
        .put("/api/tasks/abc")
        .send({ title: "Updated" });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty("error");
    });
  });

  describe("DELETE /api/tasks/:id", () => {
    it("should delete task and return 204", async () => {
      const task = await testPrisma.task.create({
        data: { title: "Delete Me" },
      });

      const res = await request(app).delete(`/api/tasks/${task.id}`);

      expect(res.status).toBe(204);

      const deleted = await testPrisma.task.findUnique({
        where: { id: task.id },
      });
      expect(deleted).toBeNull();
    });

    it("should return 404 when task not found", async () => {
      const res = await request(app).delete("/api/tasks/99999");

      expect(res.status).toBe(404);
      expect(res.body).toHaveProperty("error");
    });

    it("should return 400 when id is invalid", async () => {
      const res = await request(app).delete("/api/tasks/abc");

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty("error");
    });

    it("should return 500 on unexpected DB error", async () => {
      const task = await testPrisma.task.create({
        data: { title: "Fail Delete" },
      });

      const original = testPrisma.task.findUnique;
      testPrisma.task.findUnique = vi
        .fn()
        .mockRejectedValueOnce(new Error("DB crash")) as any;
      try {
        const res = await request(app).delete(`/api/tasks/${task.id}`);

        expect(res.status).toBe(500);
        expect(res.body).toHaveProperty("error");
      } finally {
        testPrisma.task.findUnique = original;
      }
    });
  });

  describe("500 error paths", () => {
    it("GET /api/tasks should return 500 on DB error", async () => {
      const original = testPrisma.task.findMany;
      testPrisma.task.findMany = vi
        .fn()
        .mockRejectedValueOnce(new Error("DB crash")) as any;
      try {
        const res = await request(app).get("/api/tasks");

        expect(res.status).toBe(500);
        expect(res.body).toHaveProperty("error");
      } finally {
        testPrisma.task.findMany = original;
      }
    });

    it("GET /api/tasks/:id should return 500 on DB error", async () => {
      const original = testPrisma.task.findUnique;
      testPrisma.task.findUnique = vi
        .fn()
        .mockRejectedValueOnce(new Error("DB crash")) as any;
      try {
        const res = await request(app).get("/api/tasks/1");

        expect(res.status).toBe(500);
        expect(res.body).toHaveProperty("error");
      } finally {
        testPrisma.task.findUnique = original;
      }
    });

    it("POST /api/tasks should return 500 on DB error", async () => {
      const original = testPrisma.task.create;
      testPrisma.task.create = vi
        .fn()
        .mockRejectedValueOnce(new Error("DB crash")) as any;
      try {
        const res = await request(app)
          .post("/api/tasks")
          .send({ title: "Fail Task" });

        expect(res.status).toBe(500);
        expect(res.body).toHaveProperty("error");
      } finally {
        testPrisma.task.create = original;
      }
    });

    it("PUT /api/tasks/:id should return 500 on non-404 DB error", async () => {
      const task = await testPrisma.task.create({
        data: { title: "Fail Update" },
      });

      const original = testPrisma.task.update;
      testPrisma.task.update = vi
        .fn()
        .mockRejectedValueOnce(new Error("DB crash")) as any;
      try {
        const res = await request(app)
          .put(`/api/tasks/${task.id}`)
          .send({ title: "New" });

        expect(res.status).toBe(500);
        expect(res.body).toHaveProperty("error");
      } finally {
        testPrisma.task.update = original;
      }
    });

    it("DELETE /api/tasks/:id should return 500 on non-404 DB error", async () => {
      const task = await testPrisma.task.create({
        data: { title: "Fail Delete 2" },
      });

      const original = testPrisma.task.delete;
      testPrisma.task.delete = vi
        .fn()
        .mockRejectedValueOnce(new Error("DB crash")) as any;
      try {
        const res = await request(app).delete(`/api/tasks/${task.id}`);

        expect(res.status).toBe(500);
        expect(res.body).toHaveProperty("error");
      } finally {
        testPrisma.task.delete = original;
      }
    });
  });
});
