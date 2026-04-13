import { InvestorShell } from "@/components/investor/investor-shell";

export default function InvestorLayout({ children }: { children: React.ReactNode }) {
  return <InvestorShell>{children}</InvestorShell>;
}
