import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const backendDir = path.resolve(currentDir, "..", "..", "..");

export function seedAtl() {
  execFileSync("python", ["manage.py", "seed_atl"], {
    cwd: backendDir,
    stdio: "ignore",
  });
  execFileSync("python", [
    "manage.py",
    "shell",
    "-c",
    "from atlBackend.models import Criterion, ContextRubricItem; Criterion.objects.filter(name__icontains='Blackbox').delete(); ContextRubricItem.objects.filter(title__icontains='Blackbox').delete()",
  ], {
    cwd: backendDir,
    stdio: "ignore",
  });
}
