// TARGET PATH: app/career-chat/page.tsx
import CareerChatWidget from "@/components/career-chat-widget";

interface CareerChatPageProps {
  searchParams: Promise<{ prompt?: string }>;
}

export default async function CareerChatPage({ searchParams }: CareerChatPageProps) {
  const { prompt } = await searchParams;

  return (
    <div
      className="min-h-screen text-foreground flex flex-col items-center px-4 py-10"
      style={{
        background:
          "radial-gradient(circle at 50% 0%, #f2ff6b 0%, #d4f24f 14%, transparent 38%), linear-gradient(180deg, #c6f24a 0%, #a3ec5c 14%, #7fe3a0 26%, #6fe0c0 36%, #7fe8dd 46%, #cdf3ec 58%, #ffffff 72%)",
      }}
    >
      <div className="w-full max-w-2xl h-[75vh] flex flex-col mt-6">
        <CareerChatWidget compact={false} initialPrompt={prompt} />
      </div>
    </div>
  );
}