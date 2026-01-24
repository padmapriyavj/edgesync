import { Router, Request, Response } from 'express';
import { ContentService } from '../services/content.service';
import { InvalidationProducer } from '../messaging/kafka.producer';

export function createContentRouter(
  contentService: ContentService,
  invalidationProducer: InvalidationProducer
) {
  const router = Router();

  // GET all content
  router.get('/', async (req: Request, res: Response) => {
    try {
      const content = await contentService.getAll();
      res.json({ success: true, data: content });
    } catch (error) {
      res.status(500).json({ success: false, error: (error as Error).message });
    }
  });

  // GET content by ID
  router.get('/:id', async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const content = await contentService.getById(id);
      
      if (!content) {
        return res.status(404).json({ success: false, error: 'Content not found' });
      }
      
      res.json({ success: true, data: content });
    } catch (error) {
      res.status(500).json({ success: false, error: (error as Error).message });
    }
  });

  // POST create content
  router.post('/', async (req: Request, res: Response) => {
    try {
      const content = await contentService.create(req.body);
      res.status(201).json({ success: true, data: content });
    } catch (error) {
      res.status(400).json({ success: false, error: (error as Error).message });
    }
  });

  // PUT update content - PUBLISH INVALIDATION EVENT
  router.put('/:id', async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const content = await contentService.update(id, req.body);
      
      if (!content) {
        return res.status(404).json({ success: false, error: 'Content not found' });
      }

      // Publish invalidation event to Kafka
      await invalidationProducer.publishInvalidation({
        type: 'key',
        target: `content:${id}`,
        version: content.version,
        timestamp: Date.now(),
        priority: 'HIGH',
      });

      res.json({ success: true, data: content });
    } catch (error) {
      res.status(400).json({ success: false, error: (error as Error).message });
    }
  });

  // DELETE content - PUBLISH INVALIDATION EVENT
  router.delete('/:id', async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      
      // Publish invalidation event before deleting
      await invalidationProducer.publishInvalidation({
        type: 'key',
        target: `content:${id}`,
        timestamp: Date.now(),
        priority: 'HIGH',
      });
      
      await contentService.delete(id);
      res.json({ success: true, message: 'Content deleted' });
    } catch (error) {
      res.status(500).json({ success: false, error: (error as Error).message });
    }
  });

  return router;
}