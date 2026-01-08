import { Pool } from 'pg';

export class ContentService {
  constructor(private pool: Pool) {}

  async getById(id: number) {
    const result = await this.pool.query(
      'SELECT * FROM content WHERE id = $1',
      [id]
    );
    return result.rows[0] || null;
  }

  async getAll() {
    const result = await this.pool.query(
      'SELECT * FROM content ORDER BY created_at DESC'
    );
    return result.rows;
  }

  async create(data: any) {
    const { title, slug, body, tags = [] } = data;
    
    const result = await this.pool.query(
      `INSERT INTO content (title, slug, body, version) 
       VALUES ($1, $2, $3, 1) 
       RETURNING *`,
      [title, slug, body]
    );
    
    const content = result.rows[0];
    
    // Add tags if provided
    if (tags.length > 0) {
      for (const tag of tags) {
        await this.pool.query(
          'INSERT INTO content_tags (content_id, tag) VALUES ($1, $2)',
          [content.id, tag]
        );
      }
    }
    
    return content;
  }

  async update(id: number, data: any) {
    const { title, body } = data;
    
    const result = await this.pool.query(
      `UPDATE content 
       SET title = COALESCE($1, title),
           body = COALESCE($2, body),
           version = version + 1,
           updated_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [title, body, id]
    );
    
    return result.rows[0] || null;
  }

  async delete(id: number) {
    await this.pool.query('DELETE FROM content WHERE id = $1', [id]);
  }
}