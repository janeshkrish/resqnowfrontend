import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import { Mail, RefreshCcw, Save } from "lucide-react";
import { apiFetch, readJsonSafely } from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

type EmailTemplateRecord = {
  eventType: string;
  subject: string;
  content: string;
};

const EmailTemplates = () => {
  const [templates, setTemplates] = useState<EmailTemplateRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingEventType, setSavingEventType] = useState<string | null>(null);

  const loadTemplates = async () => {
    setLoading(true);
    try {
      const response = await apiFetch("/api/admin/email-templates", {
        method: "GET",
        admin: true,
      });
      const payload = await readJsonSafely<EmailTemplateRecord[]>(response);

      if (!response.ok) {
        throw new Error(payload && typeof payload === "object" && "error" in payload ? String(payload.error) : "Failed to load email templates.");
      }

      setTemplates(Array.isArray(payload) ? payload : []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load email templates.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadTemplates();
  }, []);

  const updateTemplateField = (eventType: string, field: "subject" | "content", value: string) => {
    setTemplates((current) =>
      current.map((template) =>
        template.eventType === eventType
          ? { ...template, [field]: value }
          : template
      )
    );
  };

  const handleSave = async (template: EmailTemplateRecord) => {
    setSavingEventType(template.eventType);
    try {
      const response = await apiFetch(`/api/admin/email-templates/${encodeURIComponent(template.eventType)}`, {
        method: "PUT",
        admin: true,
        body: JSON.stringify({
          subject: template.subject,
          content: template.content,
        }),
      });
      const payload = await readJsonSafely<EmailTemplateRecord & { error?: string }>(response);

      if (!response.ok) {
        throw new Error(payload?.error || "Failed to save template.");
      }

      if (payload && payload.eventType) {
        setTemplates((current) =>
          current.map((item) => (item.eventType === payload.eventType ? payload : item))
        );
      }

      toast.success(`Saved ${template.eventType}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save template.");
    } finally {
      setSavingEventType(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Email Templates</h1>
          <p className="text-sm text-muted-foreground">
            Edit subject lines and HTML content for the system email events.
          </p>
        </div>

        <Button variant="outline" onClick={() => void loadTemplates()} disabled={loading}>
          <RefreshCcw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="flex flex-col gap-3 p-5 text-sm md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-3">
            <Mail className="mt-0.5 h-5 w-5 text-primary" />
            <div>
              <p className="font-medium">Supported placeholders</p>
              <p className="text-muted-foreground">
                Use tokens like <code>{"{{name}}"}</code>, <code>{"{{requestId}}"}</code>, <code>{"{{serviceType}}"}</code>, and <code>{"{{technicianName}}"}</code>.
              </p>
            </div>
          </div>
          <Badge variant="secondary">{templates.length} templates</Badge>
        </CardContent>
      </Card>

      {loading ? (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            Loading email templates...
          </CardContent>
        </Card>
      ) : templates.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            No email templates found.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-5">
          {templates.map((template) => {
            const isSaving = savingEventType === template.eventType;

            return (
              <Card key={template.eventType}>
                <CardHeader className="space-y-2">
                  <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <div>
                      <CardTitle className="text-lg">{template.eventType}</CardTitle>
                      <CardDescription>
                        This template is used when the <code>{template.eventType}</code> event is triggered.
                      </CardDescription>
                    </div>
                    <Button onClick={() => void handleSave(template)} disabled={isSaving}>
                      <Save className="mr-2 h-4 w-4" />
                      {isSaving ? "Saving..." : "Save"}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Subject</label>
                    <Input
                      value={template.subject}
                      onChange={(event) => updateTemplateField(template.eventType, "subject", event.target.value)}
                      placeholder="Email subject"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">HTML Content</label>
                    <Textarea
                      value={template.content}
                      onChange={(event) => updateTemplateField(template.eventType, "content", event.target.value)}
                      placeholder="Email HTML content"
                      className="min-h-[220px] font-mono text-sm"
                    />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default EmailTemplates;
