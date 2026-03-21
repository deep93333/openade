export type Verdict =
  | { action: "allow"; updatedInput?: Record<string, unknown> }
  | { action: "deny"; reason?: string };

export type ApprovalReply = {
  allow: boolean;
  updatedInput?: unknown;
  message?: string;
};

export function verdictFromReply(r: ApprovalReply): Verdict {
  if (r.allow) {
    return {
      action: "allow",
      updatedInput:
        r.updatedInput !== undefined &&
        r.updatedInput !== null &&
        typeof r.updatedInput === "object"
          ? (r.updatedInput as Record<string, unknown>)
          : undefined,
    };
  }
  return { action: "deny", reason: r.message };
}

export function replyFromVerdict(d: Verdict): ApprovalReply {
  if (d.action === "allow") {
    return { allow: true, updatedInput: d.updatedInput };
  }
  return { allow: false, message: d.reason };
}
