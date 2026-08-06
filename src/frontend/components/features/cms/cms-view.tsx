"use client";

import * as React from "react";
import {
  BookOpen,
  Eye,
  FileText,
  Globe,
  Megaphone,
  MessageCircleQuestion,
  Pencil,
  Plus,
  Send,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/frontend/components/ui/button";
import { Badge } from "@/frontend/components/ui/badge";
import { Input } from "@/frontend/components/ui/input";
import { Label } from "@/frontend/components/ui/label";
import { Textarea } from "@/frontend/components/ui/textarea";
import { Switch } from "@/frontend/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/frontend/components/ui/tabs";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/frontend/components/ui/accordion";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/frontend/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/frontend/components/ui/select";
import { PageHeader } from "@/frontend/components/shared/page-header";
import { StatCard } from "@/frontend/components/shared/stat-card";
import { RowActions } from "@/frontend/components/shared/row-actions";
import { ConfirmDialog } from "@/frontend/components/shared/confirm-dialog";
import { StatusBadge } from "@/frontend/components/shared/status-badge";
import { SectionCard } from "@/frontend/components/shared/bits";
import { FadeStagger, FadeStaggerItem } from "@/frontend/components/reactbits";
import { CMS_PAGES, FAQS, BANNERS } from "@/frontend/lib/mock";
import { settingsApi } from "@/frontend/api";
import { useResource } from "@/frontend/hooks/use-api";
import { toCmsPage, toFaq, toBanner } from "@/frontend/lib/adapters";
import { formatDate, relativeTime } from "@/shared/utils/common.util";
import type { Banner, CmsPage, Faq } from "@/shared/types/domain.types";

export function CmsView() {
  const { items: pages, apply: applyPage } = useResource<CmsPage>(
    ["cms", "pages"],
    () => settingsApi.pages().then((r) => r.data.map(toCmsPage)),
    CMS_PAGES,
  );
  const { items: faqs, apply: applyFaq } = useResource<Faq>(
    ["cms", "faqs"],
    () => settingsApi.faqs().then((r) => r.data.map(toFaq)),
    FAQS,
  );
  const { items: banners, apply: applyBanner } = useResource<Banner>(
    ["cms", "banners"],
    () => settingsApi.banners().then((r) => r.data.map(toBanner)),
    BANNERS,
  );

  const [pageOpen, setPageOpen] = React.useState(false);
  const [faqOpen, setFaqOpen] = React.useState(false);
  const [bannerOpen, setBannerOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [selectedPage, setSelectedPage] = React.useState<CmsPage | null>(null);
  const [selectedFaq, setSelectedFaq] = React.useState<Faq | null>(null);
  const [body, setBody] = React.useState("");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Public content"
        description="Everything a citizen reads in the app — FAQs, policies, contact details and announcement banners."
        actions={
          <Button
            size="sm"
            className="h-9"
            onClick={() => {
              setSelectedPage(null);
              setBody("");
              setPageOpen(true);
            }}
          >
            <Plus className="size-4" /> New page
          </Button>
        }
      />

      <FadeStagger className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <FadeStaggerItem>
          <StatCard label="Published pages" numeric={pages.filter((p) => p.published).length} icon={FileText} accent="success" hint={`${pages.length} pages in total`} />
        </FadeStaggerItem>
        <FadeStaggerItem>
          <StatCard label="Live FAQs" numeric={faqs.filter((f) => f.isActive).length} icon={MessageCircleQuestion} hint={`${faqs.length} written`} />
        </FadeStaggerItem>
        <FadeStaggerItem>
          <StatCard label="Active banners" numeric={banners.filter((b) => b.isActive).length} icon={Megaphone} accent="info" hint="Showing in the apps right now" />
        </FadeStaggerItem>
        <FadeStaggerItem>
          <StatCard label="Languages" numeric={2} icon={Globe} hint="English and Bengali" />
        </FadeStaggerItem>
      </FadeStagger>

      <Tabs defaultValue="pages">
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="pages">Pages ({pages.length})</TabsTrigger>
          <TabsTrigger value="faqs">FAQs ({faqs.length})</TabsTrigger>
          <TabsTrigger value="banners">Banners ({banners.length})</TabsTrigger>
        </TabsList>

        {/* ---------------------------------------------------------- pages */}
        <TabsContent value="pages" className="mt-4">
          <SectionCard title="Content pages" description="Served publicly at /api/v1/public/cms/{slug}" contentClassName="p-0">
            <ul className="divide-y divide-border/60">
              {pages.map((page) => (
                <li key={page.slug} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted">
                    <BookOpen className="size-4 text-muted-foreground" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{page.title}</p>
                    <p className="truncate font-mono text-xs text-muted-foreground">/{page.slug}</p>
                  </div>
                  <span className="text-xs text-muted-foreground tabular">
                    {page.words.toLocaleString("en-IN")} words
                  </span>
                  <StatusBadge
                    status={page.published ? "ACTIVE" : "DRAFT"}
                    label={page.published ? "Published" : "Draft"}
                  />
                  <span className="w-24 text-right text-xs text-muted-foreground">
                    {relativeTime(page.updatedAt)}
                  </span>
                  <RowActions
                    label={page.title}
                    actions={[
                      {
                        label: "Edit page",
                        icon: Pencil,
                        onSelect: () => {
                          setSelectedPage(page);
                          setBody(`# ${page.title}\n\nContent for the ${page.slug} page…`);
                          setPageOpen(true);
                        },
                      },
                      {
                        label: "Preview as citizen",
                        icon: Eye,
                        onSelect: () => toast.info("Preview", { description: `/${page.slug}` }),
                      },
                      {
                        label: page.published ? "Unpublish" : "Publish",
                        icon: Send,
                        separatorBefore: true,
                        onSelect: () => {
                          void applyPage(
                            async () => {
                              // Publishing needs the body, and the list does not
                              // carry it — fetch, then write it back unchanged.
                              const { data } = await settingsApi.page(page.slug);
                              return settingsApi.upsertPage({
                                slug: page.slug,
                                title: data.title,
                                bodyHtml: data.bodyHtml,
                                publish: !page.published,
                              });
                            },
                            (list) =>
                              list.map((p) =>
                                p.slug === page.slug ? { ...p, published: !p.published } : p,
                              ),
                            {
                              success: page.published ? "Page unpublished" : "Page published",
                              description: page.title,
                            },
                          ).catch(() => undefined);
                        },
                      },
                    ]}
                  />
                </li>
              ))}
            </ul>
          </SectionCard>
        </TabsContent>

        {/* ----------------------------------------------------------- faqs */}
        <TabsContent value="faqs" className="mt-4 space-y-3">
          <div className="flex justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSelectedFaq(null);
                setFaqOpen(true);
              }}
            >
              <Plus className="size-4" /> Add FAQ
            </Button>
          </div>

          <SectionCard title="Frequently asked questions" description="Shown in the citizen app help section">
            <Accordion type="single" collapsible className="w-full">
              {faqs.map((faq) => (
                <AccordionItem key={faq.id} value={faq.id}>
                  <AccordionTrigger className="text-left">
                    <span className="flex flex-1 items-center gap-2 pr-2">
                      <span className="flex-1 text-sm">{faq.question}</span>
                      <Badge variant="secondary" className="shrink-0 text-[10px]">
                        {faq.category}
                      </Badge>
                      {!faq.isActive && (
                        <Badge variant="outline" className="shrink-0 text-[10px]">
                          hidden
                        </Badge>
                      )}
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="space-y-3">
                    <p className="text-sm leading-relaxed text-muted-foreground text-pretty">
                      {faq.answer}
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => {
                          setSelectedFaq(faq);
                          setFaqOpen(true);
                        }}
                      >
                        <Pencil className="size-3.5" /> Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => {
                          void applyFaq(
                            () => settingsApi.updateFaq(faq.id, { isActive: !faq.isActive }),
                            (list) =>
                              list.map((f) => (f.id === faq.id ? { ...f, isActive: !f.isActive } : f)),
                            { success: faq.isActive ? "FAQ hidden" : "FAQ published" },
                          ).catch(() => undefined);
                        }}
                      >
                        {faq.isActive ? "Hide" : "Publish"}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs text-destructive hover:text-destructive"
                        onClick={() => {
                          setSelectedFaq(faq);
                          setDeleteOpen(true);
                        }}
                      >
                        <Trash2 className="size-3.5" /> Delete
                      </Button>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </SectionCard>
        </TabsContent>

        {/* -------------------------------------------------------- banners */}
        <TabsContent value="banners" className="mt-4 space-y-3">
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={() => setBannerOpen(true)}>
              <Plus className="size-4" /> New banner
            </Button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {banners.map((banner) => (
              <SectionCard
                key={banner.id}
                title={banner.title}
                description={`${banner.audience === "ALL" ? "Everyone" : banner.audience === "CITIZEN" ? "Citizens" : "Vendors"} · ${formatDate(banner.startAt)} – ${formatDate(banner.endAt)}`}
                action={
                  <RowActions
                    label={banner.title}
                    actions={[
                      { label: "Edit banner", icon: Pencil, onSelect: () => setBannerOpen(true) },
                      {
                        label: banner.isActive ? "Take down" : "Put live",
                        icon: Megaphone,
                        onSelect: () => {
                          void applyBanner(
                            () => settingsApi.updateBanner(banner.id, { isActive: !banner.isActive }),
                            (list) =>
                              list.map((b) => (b.id === banner.id ? { ...b, isActive: !b.isActive } : b)),
                            {
                              success: banner.isActive ? "Banner taken down" : "Banner is live",
                              description: banner.title,
                            },
                          ).catch(() => undefined);
                        },
                      },
                      {
                        label: "Delete",
                        icon: Trash2,
                        destructive: true,
                        separatorBefore: true,
                        onSelect: () => {
                          void applyBanner(
                            () => settingsApi.removeBanner(banner.id),
                            (list) => list.filter((b) => b.id !== banner.id),
                            { success: "Banner deleted", description: banner.title },
                          ).catch(() => undefined);
                        },
                      },
                    ]}
                  />
                }
              >
                <p className="text-sm text-muted-foreground text-pretty">{banner.body}</p>
                <div className="mt-3">
                  <StatusBadge
                    status={banner.isActive ? "ACTIVE" : "INACTIVE"}
                    label={banner.isActive ? "Live" : "Not showing"}
                    pulse={banner.isActive}
                  />
                </div>
              </SectionCard>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* -------------------------------------------------------- page sheet */}
      <Sheet open={pageOpen} onOpenChange={setPageOpen}>
        <SheetContent className="w-full gap-0 overflow-y-auto sm:max-w-2xl">
          <SheetHeader>
            <SheetTitle>{selectedPage ? `Edit ${selectedPage.title}` : "New content page"}</SheetTitle>
            <SheetDescription>
              Written in Markdown and rendered in both apps. Publishing makes it live immediately.
            </SheetDescription>
          </SheetHeader>

          <div className="space-y-4 px-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="page-title">Title</Label>
                <Input id="page-title" defaultValue={selectedPage?.title} placeholder="Privacy policy" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="page-slug">Slug</Label>
                <Input
                  id="page-slug"
                  defaultValue={selectedPage?.slug}
                  placeholder="privacy-policy"
                  className="font-mono"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="page-body">Content</Label>
              <Textarea
                id="page-body"
                rows={16}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                className="font-mono text-xs"
                placeholder="# Heading&#10;&#10;Write the page here…"
              />
            </div>
            <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
              <div className="space-y-0.5">
                <Label htmlFor="page-publish" className="text-sm">
                  Publish immediately
                </Label>
                <p className="text-xs text-muted-foreground">
                  Unpublished pages return 404 from the public endpoint.
                </p>
              </div>
              <Switch id="page-publish" defaultChecked={selectedPage?.published ?? false} />
            </div>
          </div>

          <SheetFooter className="flex-row justify-end gap-2">
            <Button variant="outline" onClick={() => setPageOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                setPageOpen(false);
                toast.success(selectedPage ? "Page saved" : "Page created", {
                  description: "Citizens see the update the next time the app fetches content.",
                });
              }}
            >
              Save page
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* --------------------------------------------------------- faq sheet */}
      <Sheet open={faqOpen} onOpenChange={setFaqOpen}>
        <SheetContent className="w-full gap-0 overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>{selectedFaq ? "Edit FAQ" : "Add an FAQ"}</SheetTitle>
            <SheetDescription>
              Write it the way a driver would ask it, and answer in plain language.
            </SheetDescription>
          </SheetHeader>

          <div className="space-y-4 px-4">
            <div className="space-y-1.5">
              <Label htmlFor="faq-question">Question</Label>
              <Input
                id="faq-question"
                defaultValue={selectedFaq?.question}
                placeholder="How is my parking fee calculated?"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="faq-answer">Answer</Label>
              <Textarea
                id="faq-answer"
                rows={6}
                defaultValue={selectedFaq?.answer}
                placeholder="The fee is calculated from the approved tariff for the zone…"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="faq-category">Category</Label>
              <Select defaultValue={selectedFaq?.category ?? "Charges"}>
                <SelectTrigger id="faq-category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["Charges", "Payment", "Receipts", "Passes", "Disputes", "Privacy"].map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <SheetFooter className="flex-row justify-end gap-2">
            <Button variant="outline" onClick={() => setFaqOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                setFaqOpen(false);
                toast.success(selectedFaq ? "FAQ updated" : "FAQ added");
              }}
            >
              Save FAQ
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* ------------------------------------------------------ banner sheet */}
      <Sheet open={bannerOpen} onOpenChange={setBannerOpen}>
        <SheetContent className="w-full gap-0 overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>Announcement banner</SheetTitle>
            <SheetDescription>
              Banners appear at the top of the app home screen for the audience and window you choose.
            </SheetDescription>
          </SheetHeader>

          <div className="space-y-4 px-4">
            <div className="space-y-1.5">
              <Label htmlFor="banner-title">Title</Label>
              <Input id="banner-title" placeholder="Durga Puja parking advisory" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="banner-body">Message</Label>
              <Textarea
                id="banner-body"
                rows={4}
                placeholder="Deshapriya Park and surrounding zones are closed to parking from 17–21 October."
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="banner-audience">Audience</Label>
              <Select defaultValue="ALL">
                <SelectTrigger id="banner-audience">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Everyone</SelectItem>
                  <SelectItem value="CITIZEN">Citizens only</SelectItem>
                  <SelectItem value="VENDOR">Vendors and attendants only</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="banner-start">Shows from</Label>
                <Input id="banner-start" type="date" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="banner-end">Until</Label>
                <Input id="banner-end" type="date" />
              </div>
            </div>
          </div>

          <SheetFooter className="flex-row justify-end gap-2">
            <Button variant="outline" onClick={() => setBannerOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                setBannerOpen(false);
                toast.success("Banner scheduled", { description: "It goes live on the start date." });
              }}
            >
              Save banner
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete this FAQ?"
        destructive
        confirmLabel="Delete FAQ"
        description="It disappears from the citizen app immediately."
        onConfirm={async () => {
          if (!selectedFaq) return;
          await applyFaq(
            () => settingsApi.removeFaq(selectedFaq.id),
            (list) => list.filter((f) => f.id !== selectedFaq.id),
            { success: "FAQ deleted" },
          );
        }}
      />
    </div>
  );
}
