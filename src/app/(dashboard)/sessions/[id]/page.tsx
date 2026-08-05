import { redirect } from "next/navigation";
import { ROUTES } from "@/shared/constants/routes";

/** Deep links to a single session open the log with that session pre-selected. */
export default async function SessionRedirect({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`${ROUTES.sessions}?session=${id}`);
}
