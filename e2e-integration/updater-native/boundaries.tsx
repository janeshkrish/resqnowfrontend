import { createContext, useContext, useState, type ReactNode } from 'react';
type State={role:'customer'|'technician';busy:boolean;setRole:(role:'customer'|'technician')=>void;setBusy:(busy:boolean)=>void};
const Accounts=createContext<State>({role:'customer',busy:false,setRole:()=>{},setBusy:()=>{}});
export function FixtureAccounts({children}:{children:ReactNode}){const [role,setRole]=useState<State['role']>('customer');const [busy,setBusy]=useState(false);return <Accounts.Provider value={{role,busy,setRole,setBusy}}>{children}</Accounts.Provider>;}
export const useFixtureAccounts=()=>useContext(Accounts);
export const useAuth=()=>({user:useContext(Accounts).role==='customer'?{id:'synthetic-customer'}:null});
export const useTechnicianAuth=()=>({technician:useContext(Accounts).role==='technician'?{id:'synthetic-technician'}:null,isOnline:false});
export const useTechnicianJob=()=>({acceptedJobId:useContext(Accounts).busy?'synthetic-active-job':null,pendingAcceptanceId:null});
export const API_BASE_URL='http://10.0.2.2:5198';
export const apiFetch=(path:string,options:{signal?:AbortSignal;technician?:boolean}={})=>fetch(API_BASE_URL+path,{signal:options.signal,credentials:'omit'});
