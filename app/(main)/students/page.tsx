import type { Metadata } from "next";
import { StudentsView } from "@/components/main/students-view";

export const metadata: Metadata = {
  title: "Student Files",
  robots: {
    index: false,
    follow: false,
  },
};

export default function StudentsPage() {
  return <StudentsView />;
}
