import { expect, it } from 'vitest';
import { zodResolver } from '@hookform/resolvers/zod';
import { technicianSchema } from './technicianAuthService';
import { agreementSchema } from '@/types/technician-registration';
const valid={proprietor_name:'Asha',name:'Roadside Shop',email:'',password:'',confirmPassword:'',phone:'9876543210',location:{address:'Test road',latitude:11,longitude:76,state:'Tamil Nadu'},serviceAreaRange:'10',experience:'2',specialties:['puncture'],vehicle_types:{bike:true,car:false},aadhaar_number:'123456789012',documents:{},working_hours:{opening_time:'07:00',closing_time:'19:00',weekly_off:'Sunday',is_24x7:false},app_readiness:{has_smartphone:true,preferred_language:'Tamil'},pricing_config:[],payment_details:{modes:{cash:true}},consent:{agreed:true}};
it('keeps boolean vehicle/payment dictionaries, numeric parsing and defaults through signup validation',()=>{
  const output=technicianSchema.parse(valid);expect(output.vehicle_types).toEqual({bike:true,car:false});expect(output.payment_details.modes).toEqual({cash:true});expect(output.serviceAreaRange).toBe(10);expect(output.experience).toBe(2);expect(output.towing_fleet_types).toEqual([]);
});
it('still refuses empty vehicle selection and towing without a fleet',()=>{
  expect(technicianSchema.safeParse({...valid,vehicle_types:{bike:false}}).success).toBe(false);expect(technicianSchema.safeParse({...valid,specialties:['towing']}).success).toBe(false);
});
it('preserves the explicit consent error and accepts agreement only when true',()=>{
  const result=agreementSchema.safeParse({agreed_to_terms:false});expect(result.success).toBe(false);if(!result.success)expect(result.error.issues[0].message).toBe('You must agree to the terms and declarations');expect(agreementSchema.parse({agreed_to_terms:true})).toEqual({agreed_to_terms:true});
});
it('submits parsed values through the actual form resolver, not raw numeric text',async()=>{
  const resolver=zodResolver(technicianSchema);const result=await resolver(valid,undefined,{fields:{},shouldUseNativeValidation:false});
  expect(result.errors).toEqual({});expect(result.values).toMatchObject({serviceAreaRange:10,experience:2,towing_fleet_types:[],vehicle_types:{bike:true,car:false}});
});
