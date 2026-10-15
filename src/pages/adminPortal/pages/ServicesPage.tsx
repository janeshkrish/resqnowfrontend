import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { canonicalizeServiceKey } from "@/config/technicianNormalization";
import {
  createFleet, createPricingField, createServiceMaster, createVehicleCategory, createVehicleSubcategory, deleteFleet, deletePricingField, deleteServiceMaster,
  deleteVehicleCategory, deleteVehicleSubcategory, getServiceStats, listFleets, listPricingFields, listServiceMaster, listVehicleCategories, listVehicleSubcategories,
  updateServiceMaster,
} from "../api/portalApi";
import { count, rupees } from "../format";
import { Btn, Card, Cell, Dialog, Empty, ErrorState, Icon, IconBtn, Loading, Note, Pill, Row, Switch, Table, UnderTabs, usePortalHeader } from "../ui";

// The price setup technicians fill in when they sign up: services, vehicle types and sub-types, price fields, tow trucks.

type Tab = "services" | "vehicles" | "subtypes" | "fields" | "fleets";
const active = (value: unknown) => value == null || value === true || Number(value) === 1;
const slugOf = (label: string) => label.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");

function useChange() {
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const run = async (action: () => Promise<unknown>, done: string) => {
    setBusy(true);
    try {
      await action();
      toast.success(done);
      await queryClient.invalidateQueries({ queryKey: ["portal", "setup"] });
      await queryClient.invalidateQueries({ queryKey: ["portal", "pricing-template"] });
      return true;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "That did not work.");
      return false;
    } finally {
      setBusy(false);
    }
  };
  return { busy, run };
}

export default function ServicesPage() {
  usePortalHeader("Services and prices", "What technicians can offer, which vehicles each covers, and the price fields they fill in.");
  const [tab, setTab] = useState<Tab>("services");
  const services = useQuery({ queryKey: ["portal", "setup", "services"], queryFn: listServiceMaster });
  const stats = useQuery({ queryKey: ["portal", "setup", "stats"], queryFn: getServiceStats });
  const categories = useQuery({ queryKey: ["portal", "setup", "categories"], queryFn: listVehicleCategories });
  const subcategories = useQuery({ queryKey: ["portal", "setup", "subcategories"], queryFn: listVehicleSubcategories });
  const fields = useQuery({ queryKey: ["portal", "setup", "fields"], queryFn: listPricingFields });
  const fleets = useQuery({ queryKey: ["portal", "setup", "fleets"], queryFn: listFleets });
  const error = services.error || categories.error || subcategories.error || fields.error || fleets.error;
  if (error) return <ErrorState error={error} onRetry={() => { void services.refetch(); void fields.refetch(); }} />;
  if (!services.data || !categories.data || !subcategories.data || !fields.data || !fleets.data) return <Loading height={420} label="Loading the price setup" />;
  return (
    <div className="adm-stack" data-testid="services-page">
      <UnderTabs<Tab> label="Price setup" value={tab} onChange={setTab} items={[
        { key: "services", label: "Services", count: services.data.length }, { key: "vehicles", label: "Vehicle types", count: categories.data.length },
        { key: "subtypes", label: "Sub-types", count: subcategories.data.length }, { key: "fields", label: "Price fields", count: fields.data.length }, { key: "fleets", label: "Tow trucks", count: fleets.data.length },
      ]} />
      <Note icon="info">This is what technicians see when they sign up or set their prices. Changing it changes that form for everyone; customers' request screens are not affected.</Note>
      {tab === "services" || tab === "fields" ? <Services services={services.data} stats={stats.data || []} fields={fields.data} /> : null}
      {tab === "vehicles" ? <Simple title="Vehicle types" items={categories.data.map((row) => ({ id: row.id, name: row.category_name, sub: `${subcategories.data.filter((item) => item.vehicle_category_id === row.id).length} sub-types` }))}
        add={(name) => createVehicleCategory(name)} remove={(id) => deleteVehicleCategory(id)} warn="Deleting a vehicle type removes it from the sign-up form. Technicians' saved prices for it stay in their records." /> : null}
      {tab === "subtypes" ? <Subtypes categories={categories.data} subcategories={subcategories.data} /> : null}
      {tab === "fleets" ? <Simple title="Tow trucks" items={fleets.data.map((row) => ({ id: row.id, name: row.fleet_name, sub: row.description || "" }))}
        add={(name) => createFleet(name)} remove={(id) => deleteFleet(id)} warn="Tow truck kinds are listed for reference; the sign-up form offers flatbed, wheel-lift and heavy-duty wreckers." /> : null}
    </div>
  );
}

function Services({ services, stats, fields }: { services: Awaited<ReturnType<typeof listServiceMaster>>; stats: Awaited<ReturnType<typeof getServiceStats>>; fields: Awaited<ReturnType<typeof listPricingFields>> }) {
  const change = useChange();
  const [selectedId, setSelectedId] = useState<number | null>(services[0]?.id ?? null);
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [fieldLabel, setFieldLabel] = useState("");
  const [fieldRequired, setFieldRequired] = useState(true);
  const selected = services.find((row) => row.id === selectedId) || null;
  const statOf = (id: number) => stats.find((row) => row.id === id);
  const own = fields.filter((field) => field.service_id === selectedId).sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0));
  const cols = "minmax(0,1fr) 96px 130px 96px 52px 20px";
  return (
    <div className="sv-grid">
      <div className="adm-stack">
        <div className="ap-row"><span className="ap-grow" /><Btn variant="dark" icon="add" onClick={() => setAdding(true)}>Add service</Btn></div>
        <Table label="Services" testId="services" cols={cols} minWidth={620} head={["Service", { label: "Technicians", right: true }, "Their prices", { label: "Asked, 30 d", right: true }, "On", ""]}
          foot={<span>Off: technicians no longer see it in sign-up and price setup</span>}>
          {services.map((row) => {
            const stat = statOf(row.id);
            const key = canonicalizeServiceKey(row.service_slug || row.service_name);
            return (
              <Row key={row.id} cols={cols} label={row.service_name} selected={row.id === selectedId} onClick={() => setSelectedId(row.id)}>
                <Cell><span className="ap-row"><span className="sv-pic"><img src={`/images/home/services/${key}.webp`} alt="" onError={(event) => { (event.target as HTMLImageElement).style.visibility = "hidden"; }} /></span><span className="ap-two"><b>{row.service_name}</b><span>{row.service_slug}</span></span></span></Cell>
                <Cell right className="ap-num">{stat ? count(stat.technicians) : "—"}</Cell>
                <Cell className="ap-num">{stat?.priceMin != null ? (stat.priceMin === stat.priceMax ? rupees(stat.priceMin) : `${rupees(stat.priceMin)}–${rupees(stat.priceMax)}`) : "—"}</Cell>
                <Cell right className="ap-num">{stat ? count(stat.requests30) : "—"}</Cell>
                <Cell><span onClick={(event) => event.stopPropagation()}><Switch on={active(row.active)} label={`Technicians can offer ${row.service_name}`} disabled={change.busy}
                  onChange={(on) => void change.run(() => updateServiceMaster(row.id, { service_name: row.service_name, description: row.description, icon: row.icon, active: on }), `${row.service_name} turned ${on ? "on" : "off"}`)} /></span></Cell>
                <Cell className="ap-faint"><Icon name="chevron_right" /></Cell>
              </Row>
            );
          })}
        </Table>
      </div>
      {selected ? (
        <Card title={selected.service_name} aside={<Pill tone={active(selected.active) ? "ok" : ""}>{active(selected.active) ? "On" : "Off"}</Pill>} style={{ gap: 12, alignSelf: "start" }} testId="service-side">
          <div className="ap-facts"><div className="ap-fact"><span>Name</span><b>{selected.service_name}</b></div><div className="ap-fact"><span>Key</span><b>{selected.service_slug}</b></div></div>
          <p className="ap-cap">Price fields technicians fill in</p>
          {own.length === 0 ? <p className="ap-faint" style={{ fontSize: 12.5, fontWeight: 600 }}>None yet. Technicians cannot price this service until it has one.</p> : own.map((field) => (
            <div key={field.id} className="sv-field">
              <Icon name="sell" />
              <div><b>{field.field_label}</b><span>{/distance|free_km/i.test(field.field_key) ? "km" : "₹"} · {Number(field.required) ? "required" : "optional"}</span></div>
              <code>{field.field_key}</code>
              <IconBtn icon="delete" size="sm" variant="ghost" label={`Remove ${field.field_label}`} disabled={change.busy} onClick={() => void change.run(() => deletePricingField(field.id), `${field.field_label} removed`)} />
            </div>
          ))}
          <div className="ap-field"><label htmlFor="new-field">Add a price field</label><input id="new-field" value={fieldLabel} placeholder="For example: Night charge" onChange={(event) => setFieldLabel(event.target.value)} /><small>{fieldLabel.trim() ? `Saved as ${slugOf(fieldLabel)}` : "Amounts are in rupees; a name with distance is in km."}</small></div>
          <label className="ap-row" style={{ gap: 8, fontSize: 13, fontWeight: 700 }}><input type="checkbox" checked={fieldRequired} onChange={(event) => setFieldRequired(event.target.checked)} />Every technician must fill it in</label>
          <div className="ap-row" style={{ gap: 8, flexWrap: "wrap" }}>
            <Btn size="sm" icon="add" disabled={!slugOf(fieldLabel) || change.busy} onClick={() => void change.run(() => createPricingField({ service_id: selected.id, field_key: slugOf(fieldLabel), field_label: fieldLabel.trim(), required: fieldRequired, sort_order: own.length + 1 }), `${fieldLabel.trim()} added`).then((ok) => { if (ok) setFieldLabel(""); })}>Add field</Btn>
            <span className="ap-grow" />
            <Btn size="sm" variant="danger" icon="delete" onClick={() => setDeleting(selected.id)}>Delete service</Btn>
          </div>
        </Card>
      ) : <Empty icon="build" title="Pick a service" />}
      {adding ? <AddService onClose={() => setAdding(false)} /> : null}
      {deleting != null && selected ? (
        <Dialog label={`Delete ${selected.service_name}`} title={`Delete ${selected.service_name}?`} sub="Removes the service and its price fields from the sign-up form for good." width={520} onClose={() => setDeleting(null)} testId="delete-service"
          foot={<><Btn onClick={() => setDeleting(null)}>Keep it</Btn><Btn variant="hot" icon="delete" disabled={change.busy} onClick={() => void change.run(() => deleteServiceMaster(selected.id), `${selected.service_name} deleted`).then((ok) => { if (ok) { setDeleting(null); setSelectedId(services.find((row) => row.id !== selected.id)?.id ?? null); } })}>Delete for good</Btn></>}>
          <Note tone="warn" icon="warning">Technicians who offer it keep their saved prices, but they can no longer edit them, and new technicians cannot pick it. Turning it off is usually enough.</Note>
        </Dialog>
      ) : null}
    </div>
  );
}

function AddService({ onClose }: { onClose: () => void }) {
  const change = useChange();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  return (
    <Dialog label="Add service" title="Add a service" sub="It shows in the technician sign-up once it has at least one price field." width={520} onClose={onClose} testId="add-service"
      foot={<><Btn onClick={onClose}>Cancel</Btn><Btn variant="dark" icon="add" disabled={!name.trim() || change.busy} onClick={() => void change.run(() => createServiceMaster({ service_name: name.trim(), description: description.trim() || undefined, active: true }), `${name.trim()} added`).then((ok) => { if (ok) onClose(); })}>Add service</Btn></>}>
      <div className="ap-field"><label htmlFor="svc-name">Name</label><input id="svc-name" value={name} placeholder="For example: Car wash" onChange={(event) => setName(event.target.value)} /></div>
      <div className="ap-field"><label htmlFor="svc-desc">What it is</label><input id="svc-desc" value={description} onChange={(event) => setDescription(event.target.value)} /></div>
    </Dialog>
  );
}

function Simple({ title, items, add, remove, warn }: { title: string; items: { id: number; name: string; sub: string }[]; add: (name: string) => Promise<unknown>; remove: (id: number) => Promise<unknown>; warn: string }) {
  const change = useChange();
  const [name, setName] = useState("");
  const [confirming, setConfirming] = useState<number | null>(null);
  return (
    <Card title={title} aside={`${items.length}`} testId={`setup-${title.toLowerCase().replace(/\s+/g, "-")}`}>
      {items.map((item) => (
        <div key={item.id} className="sv-field">
          <Icon name="label" />
          <div><b>{item.name}</b><span>{item.sub}</span></div>
          {confirming === item.id ? <><Btn size="sm" onClick={() => setConfirming(null)}>Keep</Btn><Btn size="sm" variant="hot" disabled={change.busy} onClick={() => void change.run(() => remove(item.id), `${item.name} deleted`).then(() => setConfirming(null))}>Delete</Btn></>
            : <IconBtn icon="delete" size="sm" variant="ghost" label={`Delete ${item.name}`} onClick={() => setConfirming(item.id)} />}
        </div>
      ))}
      <div className="ap-row" style={{ gap: 8 }}>
        <input className="ap-in" aria-label={`New ${title.toLowerCase()}`} placeholder="Name" value={name} onChange={(event) => setName(event.target.value)} />
        <Btn icon="add" disabled={!name.trim() || change.busy} onClick={() => void change.run(() => add(name.trim()), `${name.trim()} added`).then((ok) => { if (ok) setName(""); })}>Add</Btn>
      </div>
      <p className="ad-hint"><Icon name="info" />{warn}</p>
    </Card>
  );
}

function Subtypes({ categories, subcategories }: { categories: Awaited<ReturnType<typeof listVehicleCategories>>; subcategories: Awaited<ReturnType<typeof listVehicleSubcategories>> }) {
  return (
    <div className="sv-cats">
      {categories.map((category) => (
        <Simple key={category.id} title={`${category.category_name} sub-types`} items={subcategories.filter((row) => row.vehicle_category_id === category.id).map((row) => ({ id: row.id, name: row.subcategory_name, sub: "" }))}
          add={(name) => createVehicleSubcategory(category.id, name)} remove={(id) => deleteVehicleSubcategory(id)}
          warn="The sign-up form shows its own list of types for each vehicle; these names link a technician's price row to this list." />
      ))}
    </div>
  );
}
