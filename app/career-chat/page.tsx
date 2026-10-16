// TARGET PATH: app/career-chat/page.tsx
import CareerChatWidget from "@/components/career-chat-widget";
import styles from "./page.module.css";

interface CareerChatPageProps {
  searchParams: Promise<{ prompt?: string }>;
}

export default async function CareerChatPage({ searchParams }: CareerChatPageProps) {
  const { prompt } = await searchParams;

  return (
    <div
      className={`${styles.page} min-h-screen text-foreground flex flex-col items-center px-4 py-10`}
    >
      <div className="w-full max-w-2xl h-[75vh] flex flex-col mt-6">
        <CareerChatWidget compact={false} initialPrompt={prompt} />
      </div>
    </div>
  );
}