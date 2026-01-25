"use client";

import { Video, FileText, Shield, Zap, HardDrive } from "lucide-react";
import { ToolCard, SpinningLogo } from "@/components";

export default function Home() {
  return (
    <div className="min-h-screen">
      {/* Hero sectionn */}
      <section className="px-6 pt-24 pb-12 lg:pt-32 lg:pb-16">
        <div className="max-w-4xl mx-auto text-center">
          {/* Logo */}
          <div className="mb-8 flex justify-center">
            <SpinningLogo 
              size={160}
              className="lg:scale-125"
              spinOnHover
            />
          </div>

          <h1 className="text-4xl lg:text-5xl font-bold text-stone-800 tracking-tight">
            Sisyphus
          </h1>
          
          <p className="mt-4 text-stone-500 text-lg lg:text-xl max-w-xl mx-auto leading-relaxed">
            Privacy-first file tools that respect your data. 
            <span className="block mt-1 text-stone-400">Everything runs locally, nothing leaves your device.</span>
          </p>

          {/* Simple decorative divider */}
          <div className="mt-8 flex items-center justify-center gap-3">
            <div className="h-px w-16 bg-stone-300" />
          </div>
        </div>
      </section>

      {/* Tools grid - Centered layout */}
      <section className="px-6 pb-8 lg:pb-12">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-sm font-semibold text-stone-400 uppercase tracking-wider mb-4 text-center lg:text-left">
            Tools
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <ToolCard
              href="/video"
              icon={Video}
              title="Video Tools"
              description="Convert, compress, and resize videos"
            />
            <ToolCard
              href="/pdf"
              icon={FileText}
              title="PDF Tools"
              description="Compress, merge, and extract pages"
            />
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="px-6 py-12 lg:py-16 bg-stone-100/50">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-sm font-semibold text-stone-400 uppercase tracking-wider mb-6 text-center">
            Why Sisyphus?
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <FeatureCard
              icon={Shield}
              title="Zero Knowledge"
              description="Your files never leave your device. Complete privacy, always."
            />
            <FeatureCard
              icon={Zap}
              title="Lightning Fast"
              description="No uploads, no waiting. Process files instantly."
            />
            <FeatureCard
              icon={HardDrive}
              title="Works Offline"
              description="Full functionality without internet connection."
            />
          </div>
        </div>
      </section>

      {/* Quote */}
      <section className="px-6 py-16 lg:py-24">
        <div className="max-w-2xl mx-auto text-center">
          <div className="relative">
            {/* Decorative quote marks */}
            <span className="absolute -top-6 -left-2 text-6xl text-stone-200 font-serif">"</span>
            <blockquote className="relative text-xl lg:text-2xl text-stone-600 italic font-light leading-relaxed">
              The struggle itself toward the heights is enough to fill a man's heart. One must imagine Sisyphus happy.
            </blockquote>
            <span className="absolute -bottom-10 -right-2 text-6xl text-stone-200 font-serif">"</span>
          </div>
          <footer className="mt-8 flex flex-col items-center">
            <div className="h-px w-16 bg-stone-300 mb-4" />
            <cite className="text-stone-400 text-sm not-italic tracking-wide">
              Albert Camus — <span className="text-stone-500">The Myth of Sisyphus</span>
            </cite>
          </footer>
        </div>
      </section>
    </div>
  );
}

function FeatureCard({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof Shield;
  title: string;
  description: string;
}) {
  return (
    <div className="group p-6 rounded-2xl bg-white border border-stone-200/80 hover:border-stone-300 hover:shadow-lg transition-all duration-300">
      <div className="w-12 h-12 rounded-xl bg-stone-100 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform duration-300">
        <Icon className="w-6 h-6 text-stone-600" />
      </div>
      <h3 className="font-semibold text-stone-800 text-lg mb-2">{title}</h3>
      <p className="text-sm text-stone-500 leading-relaxed">{description}</p>
    </div>
  );
}
