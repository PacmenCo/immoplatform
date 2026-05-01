"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { ErrorAlert } from "@/components/ui/ErrorAlert";
import { useTranslateError } from "@/i18n/error";
import {
  markCommissionQuarterPaid,
  undoCommissionQuarterPaid,
} from "@/app/actions/commissions";

type Props = {
  teamId: string;
  year: number;
  quarter: number;
  isPaid: boolean;
};

export function MarkPaidButton({ teamId, year, quarter, isPaid }: Props) {
  const t = useTranslations("dashboard.commissions");
  const tErr = useTranslateError();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function click() {
    setError(null);
    start(async () => {
      const res = isPaid
        ? await undoCommissionQuarterPaid({ teamId, year, quarter })
        : await markCommissionQuarterPaid({ teamId, year, quarter });
      if (!res.ok) setError(res.error);
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        variant={isPaid ? "ghost" : "primary"}
        size="sm"
        onClick={click}
        loading={pending}
      >
        {isPaid ? t("markUnpaid") : t("markPaid")}
      </Button>
      {error && <ErrorAlert>{tErr(error)}</ErrorAlert>}
    </div>
  );
}
