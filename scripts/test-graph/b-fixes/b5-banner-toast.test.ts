import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const BANNER_PATH = resolve("src/components/knowledge/build-progress-banner.tsx");

test("B5 fix: BuildProgressBanner dismiss triggers toast notification", () => {
  const source = readFileSync(BANNER_PATH, "utf-8");

  const importsToast = /import\s*\{[^}]*toast[^}]*\}\s*from\s*["']sonner["']/.test(source);
  assert.ok(importsToast, "Banner must import toast from 'sonner'");

  const hasHandleDismiss = /handleDismiss\s*=/.test(source);
  assert.ok(hasHandleDismiss, "Banner must define handleDismiss function");

  const dismissCallsToast = /handleDismiss[\s\S]*?dismiss\s*\(\s*\)[\s\S]*?toast\.info/.test(
    source
  );
  assert.ok(
    dismissCallsToast,
    "handleDismiss must call dismiss() then toast.info() to notify user that job is still running"
  );

  const toastMessage = /toast\.info\s*\(\s*["']任务仍在后台运行/.test(source);
  assert.ok(toastMessage, "toast.info message must mention 任务仍在后台运行");
});
