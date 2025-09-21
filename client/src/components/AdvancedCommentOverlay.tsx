import React, { useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogOverlay } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ImageUploader } from '@/components/ImageUploader';

interface AdvancedCommentOverlayProps {
  isOpen: boolean;
  title?: string;
  initialContent?: string;
  initialImages?: string[];
  initialTitle?: string;
  onSubmit: (data: { title: string; content: string; images: string[] }) => void;
  onClose: () => void;
}

export default function AdvancedCommentOverlay({
  isOpen,
  title = 'New Comment',
  initialContent = '',
  initialImages = [],
  initialTitle = '',
  onSubmit,
  onClose,
}: AdvancedCommentOverlayProps) {
  const [content, setContent] = useState(initialContent);
  const [images, setImages] = useState<string[]>(initialImages);
  const initTitle = initialTitle || '';
  const [postTitle, setPostTitle] = useState(initTitle);
  const textRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isOpen) {
      setContent(initialContent);
      setImages(initialImages);
      setPostTitle(initialTitle || '');
      // Autofocus textarea on open
      setTimeout(() => textRef.current?.focus(), 0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, initialContent, initialImages, initialTitle]);

  const handleSubmit = () => {
    const trimmed = content.trim();
    const t = (postTitle || '').trim();
    if (!trimmed) return;
    onSubmit({ title: t, content: trimmed, images });
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogOverlay className="bg-black/70 z-[3000000]" />
      <DialogContent className="z-[3000001] max-w-xl w-[90vw] p-0 overflow-hidden rounded-lg bg-gray-800 text-white border border-gray-700">
        <DialogHeader className="px-4 pt-4 pb-2 border-b border-gray-700">
          <DialogTitle className="text-base text-white">{title}</DialogTitle>
        </DialogHeader>
        <div className="p-4 space-y-4">
          <div className="space-y-1">
            <Label htmlFor="post-title" className="text-sm text-gray-300">Title</Label>
            <Input
              id="post-title"
              value={postTitle}
              onChange={(e) => setPostTitle(e.target.value)}
              placeholder="Add a title"
              className="bg-gray-700 border-gray-600 text-white placeholder-gray-400"
            />
          </div>
          <Textarea
            ref={textRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Write your comment..."
            className="min-h-[120px] bg-gray-700 border-gray-600 text-white placeholder-gray-400"
          />
          <div>
            <ImageUploader onImagesChange={setImages} maxImages={4} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={onClose} className="text-gray-300 hover:text-white">Cancel</Button>
            <Button onClick={handleSubmit} disabled={!content.trim()} className="bg-purple-600 hover:bg-purple-700">
              Post
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
