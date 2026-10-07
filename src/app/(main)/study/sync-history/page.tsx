import {
  redirect,
} from "next/navigation";

export default function StudySyncHistoryRedirect() {
  redirect(
    "/system/study-sync",
  );
}
