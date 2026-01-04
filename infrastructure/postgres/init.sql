-- Create content table
CREATE TABLE IF NOT EXISTS content (
    id SERIAL PRIMARY KEY,
    slug VARCHAR(255) UNIQUE NOT NULL,
    title VARCHAR(500) NOT NULL,
    body TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    version INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Create content tags table
CREATE TABLE IF NOT EXISTS content_tags (
    content_id INTEGER REFERENCES content(id) ON DELETE CASCADE,
    tag VARCHAR(100) NOT NULL,
    PRIMARY KEY (content_id, tag)
);

-- Create indexes to speed up common queries
CREATE INDEX IF NOT EXISTS idx_content_slug ON content(slug);
CREATE INDEX IF NOT EXISTS idx_content_tags_tag ON content_tags(tag);
CREATE INDEX IF NOT EXISTS idx_content_updated ON content(updated_at DESC);

-- Insert seed data
INSERT INTO content (slug, title, body, version) VALUES
    ('getting-started', 'Getting Started with EdgeSync', 'EdgeSync is a distributed cache invalidation system...', 1),
    ('cache-invalidation', 'Why Cache Invalidation is Hard', 'There are only two hard things in Computer Science...', 1),
    ('distributed-systems', 'Distributed Systems 101', 'Learn the fundamentals of distributed systems...', 1)
ON CONFLICT (slug) DO NOTHING;

-- Add tags
INSERT INTO content_tags (content_id, tag) VALUES
    (1, 'tutorial'),
    (1, 'getting-started'),
    (2, 'distributed-systems'),
    (2, 'caching'),
    (3, 'distributed-systems'),
    (3, 'fundamentals')
    
-- ignore errors when trying to insert duplicate data, making the script idempotent
ON CONFLICT DO NOTHING;