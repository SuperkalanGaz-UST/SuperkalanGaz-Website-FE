export interface ServiceRequestItem {
    cylinder_size: string;
    quantity: number;
}

export interface ServiceRequestCylinderFields extends ServiceRequestItem {
    items?: ServiceRequestItem[];
}

export function serviceRequestItems(request: ServiceRequestCylinderFields): ServiceRequestItem[] {
    return request.items?.length ? request.items : [{
        cylinder_size: request.cylinder_size,
        quantity: request.quantity,
    }];
}

export function serviceRequestCylinderSummary(request: ServiceRequestCylinderFields): string {
    return serviceRequestItems(request).map(item => `${item.quantity}× ${item.cylinder_size}`).join(', ');
}

/** Total cylinders across every line, for "Qty" columns beside a mixed-size summary. */
export function serviceRequestTotalQuantity(request: ServiceRequestCylinderFields): number {
    return serviceRequestItems(request).reduce((sum, item) => sum + item.quantity, 0);
}
