import { createFileRoute } from "@tanstack/react-router";
import { AdminLayout } from "@/components/admin-ui";
export const Route = createFileRoute("/admin")({ component: AdminLayout });
