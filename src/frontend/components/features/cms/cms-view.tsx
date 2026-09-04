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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/frontend/components/ui/dialog";
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
import { Can } from "@/frontend/components/shared/can";
import { SectionCard } from "@/frontend/components/shared/bits";
import { FadeStagger, FadeStaggerItem } from "@/frontend/components/reactbits";
import { CMS_PAGES, FAQS, BANNERS } from "@/frontend/lib/mock";
import { settingsApi, ApiError } from "@/frontend/api";
import { isLiveApi } from "@/config/env";
import { useResource } from "@/frontend/hooks/use-api";
import { toCmsPage, toFaq, toBanner } from "@/frontend/lib/adapters";
import { formatDate, relativeTime } from "@/shared/utils/common.util";
import type { Banner, CmsPage, Faq } from "@/shared/types/domain.types";

/** An ISO instant as `<input type="date">` wants it, or "" when there is none. */
function dateInput(iso?: string): string {
  return iso ? new Date(iso).toISOString().slice(0, 10) : "";
}

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
  const [selectedBanner, setSelectedBanner] = React.useState<Banner | null>(null);
  const [body, setBody] = React.useState("");

  /**
   * The three editors hold their fields in state rather than in the DOM.
   *
   * They used to be uncontrolled `defaultValue` inputs, which was the reason
   * their save buttons could only ever toast: there was nothing to read back.
   * `defaultValue` also has a subtler fault here — a sheet that stays mounted
   * between openings keeps whatever was typed the first time, so editing the
   * privacy policy and then the contact page would show the privacy policy's
   * title. State that is reset by the opener fixes both at once.
   */
  const [pageForm, setPageForm] = React.useState({ slug: "", title: "", publish: false });
  const [pageBodyLoading, setPageBodyLoading] = React.useState(false);
  const [faqForm, setFaqForm] = React.useState({ question: "", answer: "", category: "Charges" });
  const [bannerForm, setBannerForm] = React.useState({
    title: "",
    body: "",
    audience: "ALL" as Banner["audience"],
    startAt: "",
    endAt: "",
  });

  /**
   * Opens the page editor, fetching the body it is about to let someone edit.
   *
   * The list carries a word count, not the markup, and `PUT /cms/pages` is an
   * upsert of the whole page — so opening an editor pre-filled with a plausible
   * placeholder and saving it would silently replace a published policy with
   * three lines of filler. The body therefore comes from `GET /cms/pages/:slug`
   * before anything can be typed over it.
   */
  const openPageEditor = async (page: CmsPage | null) => {
    setSelectedPage(page);
    setPageForm({ slug: page?.slug ?? "", title: page?.title ?? "", publish: page?.published ?? false });
    setBody("");
    setPageOpen(true);
    if (!page) return;

    if (!isLiveApi) {
      // The demo dataset holds no bodies, and inventing one is harmless here
      // because the demo save never leaves the browser.
      setBody(`# ${page.title}\n\nContent for the ${page.slug} page…`);
      return;
    }

    setPageBodyLoading(true);
    try {
      const { data } = await settingsApi.page(page.slug);
      setBody(data.bodyHtml);
    } catch (error) {
      setPageOpen(false);
      toast.error(
        error instanceof ApiError ? error.message : "The page content could not be loaded.",
        { description: "Nothing has been changed. Try again in a moment." },
      );
    } finally {
      setPageBodyLoading(false);
    }
  };

  const openFaqEditor = (faq: Faq | null) => {
    setSelectedFaq(faq);
    setFaqForm({
      question: faq?.question ?? "",
      answer: faq?.answer ?? "",
      category: faq?.category ?? "Charges",
    });
    setFaqOpen(true);
  };

  const openBannerEditor = (banner: Banner | null) => {
    setSelectedBanner(banner);
    setBannerForm({
      title: banner?.title ?? "",
      body: banner?.body ?? "",
      audience: banner?.audience ?? "ALL",
      // `<input type="date">` speaks YYYY-MM-DD; the API speaks ISO instants.
      startAt: dateInput(banner?.startAt),
      endAt: dateInput(banner?.endAt),
    });
    setBannerOpen(true);
  };

  const canSavePage = pageForm.slug.trim().length > 0 && pageForm.title.trim().length > 0;
  const canSaveFaq = faqForm.question.trim().length > 0 && faqForm.answer.trim().length > 0;
  const canSaveBanner =
    bannerForm.title.trim().length > 0 && Boolean(bannerForm.startAt) && Boolean(bannerForm.endAt);

  /**
   * `PUT /cms/pages` — an upsert keyed on the slug, which is why creating and
   * editing are one call. The demo branch mirrors that: same slug replaces,
   * new slug prepends.
   */
  const savePage = () => {
    if (!canSavePage) return;
    const slug = pageForm.slug.trim().toLowerCase();
    const title = pageForm.title.trim();

    void applyPage(
      () => settingsApi.upsertPage({ slug, title, bodyHtml: body, publish: pageForm.publish }),
      (list) => {
        const next: CmsPage = {
          slug,
          title,
          updatedAt: new Date().toISOString(),
          published: pageForm.publish,
          words: body.replace(/<[^>]*>/g, " ").split(/\s+/).filter(Boolean).length,
        };
        return list.some((pg) => pg.slug === slug)
          ? list.map((pg) => (pg.slug === slug ? next : pg))
          : [next, ...list];
      },
      {
        success: selectedPage ? "Page saved" : "Page created",
        description: pageForm.publish
          ? "Citizens see the update the next time the app fetches content."
          : "Saved as a draft. The public endpoint still returns 404 for it.",
      },
    )
      .then(() => setPageOpen(false))
      .catch(() => undefined);
  };

  const saveFaq = () => {
    if (!canSaveFaq) return;
    const question = faqForm.question.trim();
    const answer = faqForm.answer.trim();
    const category = faqForm.category;
    const existing = selectedFaq;

    void applyFaq(
      () =>
        existing
          ? settingsApi.updateFaq(existing.id, { question, answer, category })
          : settingsApi.createFaq({
              question,
              answer,
              category,
              // Appended to the end of the list. The order is the authority's
              // to arrange and there is no re-ordering control yet, so a new
              // entry going last is the least surprising place for it.
              sortOrder: faqs.length,
              isActive: true,
            }),
      (list) =>
        existing
          ? list.map((f) => (f.id === existing.id ? { ...f, question, answer, category } : f))
          : [...list, { id: `faq_demo_${list.length + 1}`, question, answer, category, isActive: true }],
      { success: existing ? "FAQ updated" : "FAQ added", description: question },
    )
      .then(() => setFaqOpen(false))
      .catch(() => undefined);
  };

  const saveBanner = () => {
    if (!canSaveBanner) return;
    const title = bannerForm.title.trim();
    const bannerBody = bannerForm.body.trim();
    const audience = bannerForm.audience;
    // A banner runs from the start of its first day to the end of its last —
    // an end date that stopped at midnight would take the notice down before
    // the day it names.
    const startAt = new Date(`${bannerForm.startAt}T00:00:00`).toISOString();
    const endAt = new Date(`${bannerForm.endAt}T23:59:59`).toISOString();
    const existing = selectedBanner;

    void applyBanner(
      () =>
        existing
          ? settingsApi.updateBanner(existing.id, { title, body: bannerBody, audience, startAt, endAt })
          : settingsApi.createBanner({
              title,
              body: bannerBody,
              audience,
              startAt,
              endAt,
              // Live from the moment it is scheduled; the window is what
              // decides whether anyone actually sees it.
              isActive: true,
            }),
      (list) =>
        existing
          ? list.map((b) => (b.id === existing.id ? { ...b, title, body: bannerBody, audience, startAt, endAt } : b))
          : [
              ...list,
              { id: `bnr_demo_${list.length + 1}`, title, body: bannerBody, audience, startAt, endAt, isActive: true },
            ],
      {
        success: existing ? "Banner updated" : "Banner scheduled",
        description: existing ? title : "It shows to the chosen audience within its window.",
      },
    )
      .then(() => setBannerOpen(false))
      .catch(() => undefined);
  };

  /**
   * The citizen's view of a page, fetched from the public endpoint.
   *
   * `state` is what makes this honest. "Loading" and "not published" are
   * different answers, and a preview that rendered the editor's draft would be
   * answering a question nobody asked: what a citizen sees is precisely whether
   * the thing is live.
   */
  const [preview, setPreview] = React.useState<{
    slug: string;
    title: string;
    state: "loading" | "ready" | "unavailable";
    bodyHtml?: string;
    reason?: string;
  } | null>(null);

  const openPreview = async (page: CmsPage) => {
    setPreview({ slug: page.slug, title: page.title, state: "loading" });
    if (!isLiveApi) {
      setPreview({
        slug: page.slug,
        title: page.title,
        state: "unavailable",
        reason:
          "Previewing reads the page back from the public API. Set NEXT_PUBLIC_API_URL to see what a citizen would.",
      });
      return;
    }
    try {
      const { data } = await settingsApi.publicPage(page.slug);
      setPreview({ slug: page.slug, title: data.title, state: "ready", bodyHtml: data.bodyHtml });
    } catch (error) {
      setPreview({
        slug: page.slug,
        title: page.title,
        state: "unavailable",
        reason:
          error instanceof ApiError && error.status === 404
            ? "This page is not published, so the public endpoint serves nothing. A citizen reaching this address sees a not-found page."
            : error instanceof ApiError
              ? error.message
              : "The public endpoint could not be reached.",
      });
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Public content"
        description="Everything a citizen reads in the app — FAQs, policies, contact details and announcement banners."
        actions={
          <Can permission="cms.write">
            <Button
              size="sm"
              className="h-9"
              onClick={() => void openPageEditor(null)}
            >
              <Plus className="size-4" /> New page
            </Button>
          </Can>
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
                        permission: "cms.write",
                        onSelect: () => void openPageEditor(page),
                      },
                      {
                        /**
                         * Reads the page back through `GET /public/pages/:slug`
                         * — the same `@Public()` route a citizen's app calls —
                         * so what appears is what is actually being served,
                         * including the nothing served for a draft. No
                         * permission: the endpoint is public.
                         */
                        label: "Preview as citizen",
                        icon: Eye,
                        onSelect: () => void openPreview(page),
                      },
                      {
                        label: page.published ? "Unpublish" : "Publish",
                        icon: Send,
                        permission: "cms.write",
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
            <Can permission="cms.write">
              <Button
                variant="outline"
                size="sm"
                onClick={() => openFaqEditor(null)}
              >
                <Plus className="size-4" /> Add FAQ
              </Button>
            </Can>
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
                    {/* Every write on this screen needs `cms.write` — the
                        permission `settings.controller.ts` puts on all fifteen
                        /cms routes. */}
                    <Can permission="cms.write">
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => openFaqEditor(faq)}
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
                                list.map((f) =>
                                  f.id === faq.id ? { ...f, isActive: !f.isActive } : f,
                                ),
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
                    </Can>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </SectionCard>
        </TabsContent>

        {/* -------------------------------------------------------- banners */}
        <TabsContent value="banners" className="mt-4 space-y-3">
          <div className="flex justify-end">
            <Can permission="cms.write">
              <Button variant="outline" size="sm" onClick={() => openBannerEditor(null)}>
                <Plus className="size-4" /> New banner
              </Button>
            </Can>
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
                      {
                        label: "Edit banner",
                        icon: Pencil,
                        permission: "cms.write",
                        // Opened *on this banner*. It used to open the sheet
                        // without saying which one, so editing an existing
                        // banner showed a blank form.
                        onSelect: () => openBannerEditor(banner),
                      },
                      {
                        label: banner.isActive ? "Take down" : "Put live",
                        icon: Megaphone,
                        permission: "cms.write",
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
                        permission: "cms.write",
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
                <Input
                  id="page-title"
                  value={pageForm.title}
                  placeholder="Privacy policy"
                  onChange={(e) => setPageForm({ ...pageForm, title: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="page-slug">Slug</Label>
                <Input
                  id="page-slug"
                  value={pageForm.slug}
                  placeholder="privacy-policy"
                  className="font-mono"
                  // The slug is the key the upsert writes against, so editing
                  // it on an existing page would create a second page rather
                  // than rename this one — and leave citizens on the old
                  // address reading the old text.
                  disabled={selectedPage !== null}
                  onChange={(e) => setPageForm({ ...pageForm, slug: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="page-body">Content</Label>
              <Textarea
                id="page-body"
                rows={16}
                value={body}
                disabled={pageBodyLoading}
                onChange={(e) => setBody(e.target.value)}
                className="font-mono text-xs"
                placeholder={pageBodyLoading ? "Loading the published content…" : "# Heading&#10;&#10;Write the page here…"}
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
              <Switch
                id="page-publish"
                checked={pageForm.publish}
                onCheckedChange={(publish) => setPageForm({ ...pageForm, publish })}
              />
            </div>
          </div>

          <SheetFooter className="flex-row justify-end gap-2">
            <Button variant="outline" onClick={() => setPageOpen(false)}>
              Cancel
            </Button>
            <Button disabled={!canSavePage || pageBodyLoading} onClick={savePage}>
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
                value={faqForm.question}
                placeholder="How is my parking fee calculated?"
                onChange={(e) => setFaqForm({ ...faqForm, question: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="faq-answer">Answer</Label>
              <Textarea
                id="faq-answer"
                rows={6}
                value={faqForm.answer}
                placeholder="The fee is calculated from the approved tariff for the zone…"
                onChange={(e) => setFaqForm({ ...faqForm, answer: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="faq-category">Category</Label>
              <Select
                value={faqForm.category}
                onValueChange={(category) => setFaqForm({ ...faqForm, category })}
              >
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
            <Button disabled={!canSaveFaq} onClick={saveFaq}>
              Save FAQ
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* ------------------------------------------------------ banner sheet */}
      <Sheet open={bannerOpen} onOpenChange={setBannerOpen}>
        <SheetContent className="w-full gap-0 overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>{selectedBanner ? "Edit banner" : "Announcement banner"}</SheetTitle>
            <SheetDescription>
              Banners appear at the top of the app home screen for the audience and window you choose.
            </SheetDescription>
          </SheetHeader>

          <div className="space-y-4 px-4">
            <div className="space-y-1.5">
              <Label htmlFor="banner-title">Title</Label>
              <Input
                id="banner-title"
                value={bannerForm.title}
                placeholder="Durga Puja parking advisory"
                onChange={(e) => setBannerForm({ ...bannerForm, title: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="banner-body">Message</Label>
              <Textarea
                id="banner-body"
                rows={4}
                value={bannerForm.body}
                placeholder="Deshapriya Park and surrounding zones are closed to parking from 17–21 October."
                onChange={(e) => setBannerForm({ ...bannerForm, body: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="banner-audience">Audience</Label>
              <Select
                value={bannerForm.audience}
                onValueChange={(audience) =>
                  setBannerForm({ ...bannerForm, audience: audience as Banner["audience"] })
                }
              >
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
                <Input
                  id="banner-start"
                  type="date"
                  value={bannerForm.startAt}
                  onChange={(e) => setBannerForm({ ...bannerForm, startAt: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="banner-end">Until</Label>
                <Input
                  id="banner-end"
                  type="date"
                  value={bannerForm.endAt}
                  min={bannerForm.startAt || undefined}
                  onChange={(e) => setBannerForm({ ...bannerForm, endAt: e.target.value })}
                />
              </div>
            </div>
          </div>

          <SheetFooter className="flex-row justify-end gap-2">
            <Button variant="outline" onClick={() => setBannerOpen(false)}>
              Cancel
            </Button>
            <Button disabled={!canSaveBanner} onClick={saveBanner}>
              Save banner
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* ----------------------------------------------------- page preview */}
      <Dialog open={preview !== null} onOpenChange={(open) => !open && setPreview(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{preview?.title}</DialogTitle>
            <DialogDescription>
              As served to a citizen from{" "}
              <span className="font-mono">/public/pages/{preview?.slug}</span>
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[60vh] overflow-y-auto rounded-lg border bg-card p-4">
            {preview?.state === "loading" && (
              <p className="text-sm text-muted-foreground">Fetching the published page…</p>
            )}
            {preview?.state === "unavailable" && (
              <p className="text-sm text-muted-foreground text-pretty">{preview.reason}</p>
            )}
            {preview?.state === "ready" &&
              (preview.bodyHtml?.trim() ? (
                /**
                 * The stored HTML, rendered as the app renders it.
                 *
                 * It is written by an administrator holding `cms.write` — the
                 * same authority that already decides what every citizen app
                 * displays — so this is not a channel for untrusted markup. It
                 * is worth knowing that the trust rests entirely on that
                 * permission: widening who may edit a page makes this a
                 * script-injection surface, and it would need sanitising then.
                 */
                <div
                  className="prose prose-sm dark:prose-invert max-w-none"
                  dangerouslySetInnerHTML={{ __html: preview.bodyHtml }}
                />
              ) : (
                <p className="text-sm text-muted-foreground">
                  The page is published but carries no content. Citizens see an empty page.
                </p>
              ))}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setPreview(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
