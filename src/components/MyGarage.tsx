import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import MaterialSymbol from "@/components/home/MaterialSymbol";
import AddVehicleFlow, { type NewVehicle } from "@/components/garage/AddVehicleFlow";
import { EmptyGarage, RemoveDialog, VehicleBay, VehicleChips, VehicleSheet } from "@/components/garage/GarageParts";
import { useAuth } from "@/contexts/AuthContext";
import { garageCountLine, helpHistory } from "@/lib/garageShow";
import { MY_REQUESTS_KEY, fetchMyRequests } from "@/lib/myRequests";
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

  // The vehicle on show in the bay, and the one that was there before it (seen driving off).
  const [shown, setShown] = useState<{ id: number | null; previousId: number | null }>({ id: null, previousId: null });
  const onShow = vehicles.find((v) => v.id === shown.id) ?? vehicles[0] ?? null;
  const leaving = vehicles.find((v) => v.id === shown.previousId) ?? null;
  const show = (vehicle: Vehicle) => {
    if (onShow && vehicle.id !== onShow.id) setShown({ id: vehicle.id, previousId: onShow.id });
  };
  const step = (by: 1 | -1) => {
    const next = onShow ? vehicles[vehicles.findIndex((v) => v.id === onShow.id) + by] : undefined;
    if (next) show(next);
  };

  // Past requests, for "Helped" and "Last help". The garage works without them.
  const requestsQuery = useQuery({
    queryKey: MY_REQUESTS_KEY,
    queryFn: ({ signal }) => fetchMyRequests(signal),
    enabled: Boolean(user?.id),
    staleTime: 60_000,
  });

  const closeAdd = () => {
    setAdding(false);
    onAddClosed?.();
  };

  const add = useMutation({
    mutationFn: (input: NewVehicle) => addVehicle(input),
    onSuccess: async (_result, input) => {
      await queryClient.invalidateQueries({ queryKey: GARAGE_QUERY_KEY });
      // The new vehicle is the newest, so it is the one on show.
      setShown({ id: null, previousId: null });
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
  } else if (onShow) {
    body = (
      <>
        <div className="rqg-head">
          <h1 className="rqg-h1">My garage</h1>
          <p className="rqg-sub">{garageCountLine(vehicles)}</p>
        </div>
        <VehicleBay
          vehicle={onShow}
          previous={leaving}
          position={vehicles.findIndex((v) => v.id === onShow.id) + 1}
          total={vehicles.length}
          history={requestsQuery.data ? helpHistory(onShow, requestsQuery.data) : null}
          onHelp={() => getHelp(onShow)}
          onMore={() => setSheetId(onShow.id)}
          onSwipe={step}
        />
        {vehicles.length > 1 ? <VehicleChips vehicles={vehicles} shownId={onShow.id} onShow={show} /> : null}
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
