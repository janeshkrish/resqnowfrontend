import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import MaterialSymbol from "@/components/home/MaterialSymbol";
import AddVehicleFlow, { type NewVehicle } from "@/components/garage/AddVehicleFlow";
import { EmptyGarage, HeroCard, RemoveDialog, VehicleRow, VehicleSheet } from "@/components/garage/GarageParts";
import { useAuth } from "@/contexts/AuthContext";
import {
  GARAGE_QUERY_KEY,
  addVehicle,
  helpPath,
  listVehicles,
  removeVehicle,
  setVehicleStatus,
  shortMake,
  type Vehicle,
  type VehicleStatus,
} from "@/lib/garage";
import { cn } from "@/lib/utils";

export type { Vehicle } from "@/lib/garage";

type Props = {
  /** Open the add-vehicle steps straight away (the /my-garage/add link). */
  startAdding?: boolean;
  /** Called when the add steps close, so the page can drop /add from the address. */
  onAddClosed?: () => void;
  /** Shows a back button in the header. */
  onBack?: () => void;
  /** Inside Settings on larger screens: no full-page background or bottom-menu spacing. */
  embedded?: boolean;
};

const byNewest = (list: Vehicle[]) =>
  [...list].sort((a, b) => (Date.parse(b.created_at ?? "") || b.id) - (Date.parse(a.created_at ?? "") || a.id));

export default function MyGarage({ startAdding = false, onAddClosed, onBack, embedded = false }: Props) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [adding, setAdding] = useState(startAdding);
  const [sheetId, setSheetId] = useState<number | null>(null);
  const [removeTarget, setRemoveTarget] = useState<Vehicle | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => { if (startAdding) setAdding(true); }, [startAdding]);
  useEffect(() => () => clearTimeout(toastTimer.current), []);

  const showToast = (message: string) => {
    setToast(message);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 4000);
  };

  const vehiclesQuery = useQuery({
    queryKey: GARAGE_QUERY_KEY,
    queryFn: listVehicles,
    enabled: Boolean(user?.id),
  });
  const vehicles = byNewest(vehiclesQuery.data ?? []);
  const sheetVehicle = vehicles.find((v) => v.id === sheetId) ?? null;

  const closeAdd = () => {
    setAdding(false);
    onAddClosed?.();
  };

  const add = useMutation({
    mutationFn: (input: NewVehicle) => addVehicle(input),
    onSuccess: async (_result, input) => {
      await queryClient.invalidateQueries({ queryKey: GARAGE_QUERY_KEY });
      closeAdd();
      showToast(`${shortMake(input.make)} ${input.model} saved to your garage`);
    },
  });

  const remove = useMutation({
    mutationFn: (vehicle: Vehicle) => removeVehicle(vehicle.id),
    onSuccess: async (_result, vehicle) => {
      setRemoveTarget(null);
      setSheetId(null);
      await queryClient.invalidateQueries({ queryKey: GARAGE_QUERY_KEY });
      showToast(`${shortMake(vehicle.make)} ${vehicle.model} removed`);
    },
    onError: () => showToast("The vehicle wasn’t removed. Try again."),
  });

  const status = useMutation({
    mutationFn: ({ vehicle, value }: { vehicle: Vehicle; value: VehicleStatus }) => setVehicleStatus(vehicle.id, value),
    // Show the new status straight away; put it back if the save fails.
    onMutate: async ({ vehicle, value }) => {
      await queryClient.cancelQueries({ queryKey: GARAGE_QUERY_KEY });
      const previous = queryClient.getQueryData<Vehicle[]>(GARAGE_QUERY_KEY);
      queryClient.setQueryData<Vehicle[]>(GARAGE_QUERY_KEY, (list) => (list ?? []).map((v) => (v.id === vehicle.id ? { ...v, status: value } : v)));
      return { previous };
    },
    onError: (_error, _input, context) => {
      if (context?.previous) queryClient.setQueryData(GARAGE_QUERY_KEY, context.previous);
      showToast("The status wasn’t changed. Try again.");
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: GARAGE_QUERY_KEY }),
  });

  const getHelp = (vehicle: Vehicle) => {
    setSheetId(null);
    navigate(helpPath(vehicle));
  };

  const startAdd = () => {
    add.reset();
    setSheetId(null);
    setAdding(true);
  };

  let body;
  if (adding) {
    body = <AddVehicleFlow onCancel={closeAdd} onSave={(input) => add.mutate(input)} saving={add.isPending} error={add.isError ? "The vehicle wasn’t saved." : null} />;
  } else if (vehiclesQuery.isPending) {
    body = (
      <div className="rqg-loading" role="status" aria-label="Loading your vehicles">
        <span className="rqg-skel" style={{ height: 32, width: "55%" }} />
        <span className="rqg-skel" style={{ height: 318, borderRadius: 24 }} />
        <span className="rqg-skel" style={{ height: 80, borderRadius: 20 }} />
      </div>
    );
  } else if (vehiclesQuery.isError) {
    body = (
      <div className="rqg-message" role="alert">
        <span className="rqg-message-ic"><MaterialSymbol name="error" /></span>
        <h2>Your vehicles didn’t load</h2>
        <p>Check your connection and try again.</p>
        <button type="button" className="rqg-btn rq-press" onClick={() => void vehiclesQuery.refetch()}><MaterialSymbol name="refresh" />Try again</button>
      </div>
    );
  } else if (!vehicles.length) {
    body = <EmptyGarage onAdd={startAdd} />;
  } else {
    const [hero, ...rest] = vehicles;
    body = (
      <>
        <div className="rqg-head">
          <p className="rqg-kicker">My garage</p>
          <h1 className="rqg-h1">Your vehicles</h1>
          <p className="rqg-sub">{vehicles.length} {vehicles.length === 1 ? "vehicle" : "vehicles"} · pick one when you ask for help</p>
        </div>
        <HeroCard vehicle={hero} onHelp={() => getHelp(hero)} onMore={() => setSheetId(hero.id)} />
        {rest.length ? (
          <>
            <p className="rqg-sec"><span>Also in your garage</span><span>{rest.length}</span></p>
            <div className="rqg-list">
              {rest.map((vehicle) => <VehicleRow key={vehicle.id} vehicle={vehicle} onOpen={() => setSheetId(vehicle.id)} />)}
            </div>
          </>
        ) : null}
        <p className="rqg-tip"><MaterialSymbol name="bolt" />When you ask for help, pick a saved vehicle and its details fill in for you.</p>
      </>
    );
  }

  return (
    <div className={cn("rqg", embedded && "rqg--embedded")}>
      {adding ? null : (
        <div className="rqg-top">
          {onBack ? (
            <button type="button" className="rqg-icon-btn rq-press" aria-label="Go back" onClick={onBack}><MaterialSymbol name="arrow_back" /></button>
          ) : <span />}
          {vehiclesQuery.data?.length ? (
            <button type="button" className="rqg-add-btn rq-press" onClick={startAdd}><MaterialSymbol name="add" />Add vehicle</button>
          ) : null}
        </div>
      )}
      {body}
      {toast ? <p className="rqg-toast" role="status"><MaterialSymbol name="check_circle" />{toast}</p> : null}
      <VehicleSheet
        vehicle={sheetVehicle}
        onClose={() => setSheetId(null)}
        onHelp={getHelp}
        onStatus={(vehicle, value) => status.mutate({ vehicle, value })}
        onRemove={(vehicle) => { setSheetId(null); setRemoveTarget(vehicle); }}
      />
      <RemoveDialog
        vehicle={removeTarget}
        busy={remove.isPending}
        onCancel={() => setRemoveTarget(null)}
        onConfirm={(vehicle) => remove.mutate(vehicle)}
      />
    </div>
  );
}
