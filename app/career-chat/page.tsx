// TARGET PATH: app/career-chat/page.tsx
import CareerChatWidget from "@/components/career-chat-widget";

export default function CareerChatPage() {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col items-center px-4 py-8">
      <div className="w-full max-w-2xl h-[75vh] flex flex-col">
        <CareerChatWidget compact={false} />
      </div>
    </div>
  );
}
