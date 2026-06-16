"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Spinner } from "@phosphor-icons/react";
import { toast } from "sonner";

type ExtractionStatus = "NOT_EXTRACTED" | "EXTRACTING" | "EXTRACTED" | "FAILED";

interface ExtractBookButtonProps {
  bookId: string;
  status: ExtractionStatus;
}

interface ExtractResponse {
  status: "EXTRACTED" | "EXTRACTING" | "FAILED";
  reused?: boolean;
  started?: boolean;
}

const POLL_INTERVAL_MS = 4000;
const MAX_POLLS = 30;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function ExtractBookButton({ bookId, status }: ExtractBookButtonProps) {
  const router = useRouter();
  // Track whether we are mid-request/poll so the UI can show a spinner even
  // before the server-rendered status flips to EXTRACTING.
  const [isWorking, setIsWorking] = useState(false);

  async function postExtract(): Promise<ExtractResponse> {
    const res = await fetch(`/api/library/books/${bookId}/extract`, {
      method: "POST",
    });
    if (!res.ok) {
      throw new Error(`Extraction request failed (${res.status})`);
    }
    return (await res.json()) as ExtractResponse;
  }

  async function handleClick() {
    if (isWorking) return;
    setIsWorking(true);
    try {
      toast.info("Starting deep extraction...");
      let result = await postExtract();

      if (result.status === "EXTRACTED") {
        toast.success(
          result.reused ? "Extraction reused from shared library." : "Extraction complete!",
        );
        router.refresh();
        return;
      }

      if (result.status === "FAILED") {
        toast.error("Extraction failed. Please try again.");
        router.refresh();
        return;
      }

      // status === "EXTRACTING" -> poll the idempotent endpoint until it settles.
      for (let attempt = 0; attempt < MAX_POLLS; attempt++) {
        await sleep(POLL_INTERVAL_MS);
        result = await postExtract();
        if (result.status === "EXTRACTED") {
          toast.success("Extraction complete!");
          router.refresh();
          return;
        }
        if (result.status === "FAILED") {
          toast.error("Extraction failed. Please try again.");
          router.refresh();
          return;
        }
      }

      toast.info("Extraction is still running. Refresh in a bit to check progress.");
      router.refresh();
    } catch (error) {
      console.error(error);
      toast.error("Something went wrong starting the extraction.");
    } finally {
      setIsWorking(false);
    }
  }

  const busy = isWorking || status === "EXTRACTING";

  if (busy) {
    return (
      <Button disabled className="w-full gap-2">
        <Spinner className="h-4 w-4 animate-spin" />
        Extracting...
      </Button>
    );
  }

  if (status === "EXTRACTED") {
    return (
      <Button variant="secondary" size="sm" onClick={handleClick} className="gap-2">
        Re-extract
      </Button>
    );
  }

  if (status === "FAILED") {
    return (
      <Button variant="outline" onClick={handleClick} className="w-full gap-2">
        Retry extraction
      </Button>
    );
  }

  // NOT_EXTRACTED
  return (
    <Button onClick={handleClick} className="w-full gap-2">
      Run Deep Extraction
    </Button>
  );
}
