-- Create chats table for storing chat metadata
CREATE TABLE IF NOT EXISTS chats (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  thread_id TEXT, -- OpenAI thread ID
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_chats_user_id ON chats(user_id);
CREATE INDEX IF NOT EXISTS idx_chats_updated_at ON chats(updated_at);

-- Enable Row Level Security
ALTER TABLE chats ENABLE ROW LEVEL SECURITY;

-- Create policy to allow users to only see their own chats
CREATE POLICY "Users can view their own chats" ON chats
  FOR SELECT USING (auth.uid() = user_id);

-- Create policy to allow users to insert their own chats
CREATE POLICY "Users can insert their own chats" ON chats
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Create policy to allow users to update their own chats
CREATE POLICY "Users can update their own chats" ON chats
  FOR UPDATE USING (auth.uid() = user_id);

-- Create policy to allow users to delete their own chats
CREATE POLICY "Users can delete their own chats" ON chats
  FOR DELETE USING (auth.uid() = user_id);

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_chats_updated_at 
  BEFORE UPDATE ON chats 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column(); 