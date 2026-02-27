"use client";

import { motion } from "framer-motion";
import { NewsletterForm } from "@/components/newsletter/NewsletterForm";
import type { HeroBlockData } from "@/lib/types";

const defaultTitle = "Nirave Gondhia.";
const defaultSubtitle = "Journalist, Host & Creator.";
const defaultDescription = "Seen in: Forbes, TechRadar, Android Central";

type HeroProps = {
  data?: HeroBlockData | null;
};

export function Hero({ data }: HeroProps) {
  const title = data?.title?.trim() || defaultTitle;
  const subtitle = data?.subtitle?.trim() || defaultSubtitle;
  const description = data?.description?.trim() || defaultDescription;
  const headshotUrl = data?.headshot_url?.trim() || null;
  const isSquare = data?.shape === "square";
  const wrapperClass = isSquare
    ? "aspect-square w-64 shrink-0 overflow-hidden rounded-lg bg-hot-gray"
    : "aspect-square w-64 shrink-0 overflow-hidden rounded-full bg-hot-gray";

  return (
    <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
      <div className="flex flex-col items-center gap-12 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex flex-col">
          <motion.h1
            className="font-serif text-5xl font-medium text-hot-white"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          >
            {title}
          </motion.h1>
          <motion.p
            className="mt-3 font-sans text-xl text-gray-400"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: "easeOut", delay: 0.1 }}
          >
            {subtitle}
          </motion.p>
          <motion.p
            className="mt-6 font-sans text-sm text-hot-white/60"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: "easeOut", delay: 0.2 }}
          >
            {description}
          </motion.p>
          <div className="mt-8 p-8">
            <NewsletterForm
              source="homepage_cta"
              description={data?.newsletterDescription?.trim() || undefined}
              buttonText={data?.newsletterButtonText?.trim() || "Join"}
            />
          </div>
        </div>

        <motion.div
          className={wrapperClass}
          aria-hidden
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, ease: "easeOut", delay: 0.3 }}
        >
          {headshotUrl ? (
            <img
              src={headshotUrl}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : null}
        </motion.div>
      </div>
    </section>
  );
}
