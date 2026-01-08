import { Router } from "express";
import { ContentService } from "../services/content.service";
import { validateCreateContent } from "../utils/validate";

export function createContentRouter(contentService: ContentService) {
  const router = Router();

  //GET all the content
  router.get("/", async (req, res) => {
    try {
      const content = await contentService.getAll();
      res.json({ success: true, data: content });
    } catch (error) {
      res.status(500).json({ success: false, error: (error as Error).message });
    }
  });

  router.get("/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const content = await contentService.getById(id);

      if (!content) {
        return res
          .status(404)
          .json({ success: false, error: "Content not found" });
      }
      res.json({ success: true, data: content });
    } catch (error) {
      res.status(500).json({ success: false, error: (error as Error).message });
    }
  });

  router.post("/", async (req, res) => {
    try {
      validateCreateContent(req.body);
      const content = await contentService.create(req.body);
      res.status(201).json({ success: true, data: content });
    } catch (error) {
      res.status(400).json({ success: false, error: (error as Error).message });
    }
  });

  router.put("/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const content = await contentService.update(id, req.body);

      if (!content) {
        return res
          .status(404)
          .json({ success: false, error: "Content not found" });
      }

      res.json({ success: true, data: content });
    } catch (error) {
      res.status(400).json({ success: false, error: (error as Error).message });
    }
  });

  router.delete("/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await contentService.delete(id);
      res.json({ success: true, message: "Content deleted" });
    } catch (error) {
      res.status(500).json({ success: false, error: (error as Error).message });
    }
  });

  return router;
}
