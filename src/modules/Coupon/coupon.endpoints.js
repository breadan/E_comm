import { systemRoles } from '../../utils/system-roles.js';

export const endpointsRoles = {
  ADD_COUPON: [systemRoles.ADMIN, systemRoles.SUPER_ADMIN],
};
