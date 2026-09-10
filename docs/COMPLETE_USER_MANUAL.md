# Oruthota Chalets Administration System

## Complete User Manual and Feature Guide

**Document version:** 1.0  
**Application reviewed:** Current repository implementation  
**Audience:** Administrators, front-desk staff, waiters, kitchen staff, payment/accounts staff, HR staff, inventory staff, and temporary staff

---

## 1. Purpose of this manual

This manual explains the features currently implemented in the Oruthota Chalets Administration System and gives practical steps for performing the main tasks. The application combines guest operations, restaurant operations, inventory and procurement, kitchen work, accounting, event management, services income, HR/payroll, and content administration.

The menu is permission-driven. A user sees only the sections explicitly assigned to the user's role or account. An unrestricted administrator normally sees all sections. If a page described here is missing from your menu, contact an administrator rather than trying to open it directly.

## 2. Getting started

### 2.1 Sign in

1. Open the system login page.
2. Enter either your email address or employee number.
3. Enter your password.
4. Select **Login**.
5. After successful authentication, use the application selector or dashboard appropriate to your access.

If login fails, verify capitalization, employee number formatting, and that the account has been created and enabled by an administrator.

### 2.2 Use the Home page

1. Open **Home** from the sidebar.
2. Review the tiles for sections assigned to you.
3. Use **Search your sections** to filter the available modules.
4. Select a tile to open that module.
5. If the page says no sections are assigned, ask an administrator to update your permissions.

### 2.3 Update or review your profile

1. Open **Profile**, or select your name/avatar at the bottom of the sidebar.
2. Review personal and employment information.
3. Contact an administrator or HR user if a read-only value is incorrect.

### 2.4 Sign out

1. Select **Logout** at the bottom of the sidebar.
2. Confirm that the login screen appears before leaving a shared device.

## 3. Administration and security

### 3.1 Manage users and employees

The system supports employee identity, contact data, employment configuration, payroll data, security credentials, and page permissions.

To add a user:

1. Open **User Management** and select **Add New User**.
2. On **Employee Details**, enter name, email, phone, gender, NIC, join date, and address. The employee number is assigned automatically when saved.
3. On **Employment & Payroll**, select department, job title, role, reporting manager, leave scheme, and working calendar.
4. Enter monthly basic salary if payroll is used.
5. Enable service charge and enter its rate when applicable.
6. Add allowance presets or custom allowance names and amounts as required.
7. On **Security**, enter and confirm the initial password.
8. On **Permissions**, select the pages the user needs. For administrators, enable restricted access only when the administrator should see selected pages rather than everything.
9. Enable **Inventory Admin** if applicable.
10. Save the user.

To edit a user:

1. Open **User Management** or **HRMS > Employees**.
2. Find the person and select **Edit**.
3. Update the relevant tab.
4. To change a password, enable the update-password option and enter the new password twice.
5. Save changes.

To change only a role, select the new role in the user list and select **Save**. To remove an account, select **Delete** and carefully confirm the warning.

### 3.2 Configure roles and page permissions

1. Open **HRMS > Role Permissions**.
2. Select the role tab.
3. Select or clear the pages the role should access.
4. Use bulk selection controls when appropriate.
5. Select **Save** for that role.

To create a custom role:

1. Select **Create New Role**.
2. Enter a concise role name, such as `receptionist`.
3. Create the role.
4. Open its tab, assign pages, and save.

Custom roles can also be renamed. Review assigned users before renaming or deleting organizational role data.

## 4. Customer and front-desk operations

### 4.1 Front Desk overview

The Front Desk workspace has four operational tabs:

- **Arrivals & Check-In** — upcoming room/chalet arrivals and room assignment.
- **In-House Guests** — currently checked-in guests and guest-pass actions.
- **Billing & Check-Out** — guest folios, charges, settlement, and checkout.
- **History** — completed guest stays and historical bills.

### 4.2 Check in a guest

1. Open **Customers > Front Desk (Check In/Out)**.
2. Select **Arrivals & Check-In**.
3. Find the reservation or chalet booking.
4. If no room is assigned, select **Assign Room**, choose an eligible room, and confirm.
5. Select **Check In**.
6. Verify guest, stay, package, occupancy, room, and contact details.
7. Complete the check-in action.
8. Print or share the guest check-in pass/QR code when required.

The QR guest pass can later be used to identify the guest when adding service income or guest charges.

### 4.3 Manage an in-house guest

1. Open **In-House Guests**.
2. Find the guest by name, room, booking, or other displayed details.
3. Select **View Guest** to review the stay.
4. Use **Move to Bill** or the available billing action to include guest charges in checkout billing.
5. For package bookings, open **Package Meals** to review or manage meals linked to the package.
6. Reprint/share the guest pass if required.

### 4.4 Bill and check out a guest

1. Open **Billing & Check-Out**.
2. Select the guest/room.
3. Review room charges, restaurant room charges, activities, facilities, services, payments, and adjustments shown in the folio.
4. Verify that all pending charges have been added.
5. Use the settlement action and select the payment details required by the dialog.
6. Confirm settlement.
7. Complete checkout only after the outstanding balance is zero or otherwise valid under the business process.
8. Print or share the final bill/receipt.

### 4.5 Review front-desk history

1. Open **History**.
2. Search or filter for the completed stay.
3. Open the record to review guest and billing history.
4. Use the historical-bill function when a past receipt or folio is needed.

### 4.6 Customers and loyalty

**All Customers** provides the guest/customer directory. Use it to search and review stored customer data.

To add a loyalty customer:

1. Open **Loyalty Customers**.
2. Select **Add Customer**.
3. Enter the required identity/contact and loyalty information.
4. Save the record.
5. Use the row menu to edit an existing member.

**Loyalty Discounts** manages discount tiers. Configure tiers before expecting loyalty discounts to be consistently applied.

## 5. Room, reservation, chalet, and buffet booking management

### 5.1 Room Management

1. Open **Reservations > Room Management**.
2. Select the add-room action.
3. Enter room title/number, type, nightly price, room count, view, and status.
4. Save.
5. Use edit to change room details or status.

Room statuses include **available**, **occupied**, and **maintenance**. Do not assign a maintenance room to a guest.

### 5.2 Reservation Management

1. Open **Reservation Management**.
2. Select **Add Reservation**.
3. Enter guest details, room, check-in/check-out dates and times, cost, and status.
4. Save the reservation.
5. Use edit to update dates, room, guest, payment status, or reservation status.
6. Use delete only for records that should be permanently removed, and confirm carefully.

Typical reservation statuses are pending, booked, confirmed, checked-in, checked-out/completed, and cancelled.

The separate **Booking Management** page provides a list-oriented current/past booking workflow and status actions. Use the booking area established by your organization; avoid entering the same stay in both systems unless the process explicitly requires it.

### 5.3 Chalet rooms

1. Open **Chalet Booking > Chalet Rooms**.
2. Review totals by room status.
3. Add or edit a chalet room.
4. Enter the name/room details and operational status.
5. Save.

### 5.4 Room rates and packages

To configure rates:

1. Open **Room Rates & Packages**.
2. Select **Rate Matrix**.
3. Enter the nightly LKR rate for each package and occupancy combination.
4. Select **Save Rates**.
5. Remember that the interface states a 10% service charge applies to these rates.

To configure a package:

1. Select **Packages** and then **New Package**.
2. Enter the package name and its included details.
3. Add meal/facility inclusions as needed.
4. Save.
5. Use edit for later changes or delete after confirming that the package is no longer required.

### 5.5 Chalet bookings

1. Open **Chalet Bookings**.
2. Select **New Booking**.
3. Enter guest, dates, occupancy, package, pricing, and contact details.
4. Save the booking.
5. Use **Assign Room** when a confirmed booking needs a room.
6. Use edit to update the booking.
7. Use **Activities** to manage booking-related facility/activity usage.
8. Use **All Bookings** and **Checked-In Guests** tabs to monitor status.

The dashboard cards show totals for pending, confirmed, and checked-in bookings.

### 5.6 Buffet packages and bookings

To create a buffet package:

1. Open **Buffet Packages**.
2. Add a package and enter its name, pricing, and menu/inclusion data.
3. Save and verify that the package is available for booking.

To create a buffet booking:

1. Open **Buffet Bookings**.
2. Select the create-booking action.
3. Enter customer, date/time, guest count, selected package, payment, and other required information.
4. Save.
5. Open the booking to review it.
6. Use **Print** or **Share** for the booking document.

## 6. Restaurant and POS operations

### 6.1 Restaurant setup sequence

Before taking orders, an administrator should complete setup in this order:

1. **Restaurant Settings** — main warehouse, sections, VAT, service charge, and related charges.
2. **Menu Section Settings** — menu sections/categories and dish varieties.
3. **Menu Management** — sale items, prices, inventory linkage, and availability.
4. **Table Management** — table number, capacity, location/section, and initial status.

### 6.2 Restaurant Settings

1. Open **Restaurant Settings**.
2. Select and save the restaurant warehouse used for stock movements.
3. Add restaurant sections such as Main Hall, Poolside, or Rooftop.
4. Edit or remove sections as needed; first ensure no active tables/items depend on them.
5. Configure VAT and service-charge settings.
6. Save each settings area.

### 6.3 Menu sections and menu items

To configure menu organization:

1. Open **Menu Section Settings**.
2. Add the required sections/categories and dish varieties.
3. Edit or remove obsolete values carefully.

To add a menu item:

1. Open **Menu Management**.
2. Select **Add Menu Item**.
3. Enter name, description, selling price, buying price, category/section, and dish variety.
4. Select **Inventoried** or **Non-Inventoried** stock type.
5. For an inventoried/direct item, select the linked inventory item and appropriate unit details.
6. Select direct or indirect selling behavior as required.
7. Set availability and save.

Use batch pricing when many item prices need the same type of update. Mark unavailable items unavailable instead of deleting historical products.

### 6.4 Table Management

1. Open **Table Management**.
2. Add a table.
3. Enter table number, capacity, location/restaurant section, and status.
4. Save.
5. Edit table configuration when the floor plan changes.

Statuses include **available**, **occupied**, and **reserved**.

### 6.5 Waiter order workflow

1. Open the waiter application or **Restaurant Dashboard**.
2. Select an available table/section.
3. Open the order dialog.
4. Search or browse the menu and select items.
5. Adjust quantities and add each item to the order.
6. Confirm/send the order. Kitchen items appear in Kitchen Orders.
7. Add more items later by reopening the occupied table.
8. Track prepared/ready items and serve them.
9. Send the order to billing when the customer requests the bill.

For an in-house guest, use the **Add to Bill**/room-charge function, identify the guest or room, verify the amount, and confirm. This changes the order to a room-charge flow rather than normal restaurant payment.

### 6.6 POS Terminal

1. Open **POS Terminal**.
2. Browse or search products/menu items.
3. Select items to add them to **Current Order**.
4. Use plus/minus controls to adjust quantity.
5. Use the trash/clear control to remove unwanted cart contents.
6. Review the order total.
7. Select the checkout/payment action.
8. Choose the payment method and complete the transaction.

### 6.7 Billing and payments

1. Open **Restaurant Billing**.
2. Select an active table.
3. Review every item, quantity, subtotal, discount, tax/service charge, and total.
4. Make any permitted adjustment before payment.
5. Select the payment action.
6. Choose cash or card and enter the requested details.
7. Confirm payment.
8. Print the receipt if required.

Paid bills should not be edited. Cancel only under an authorized correction process.

### 6.8 Restaurant account and analytics

**Restaurant Account** summarizes restaurant payment/account activity and supports the configured cash/accounting flow. Review transactions, select valid destination accounts, and transfer cash only after reconciling the physical amount.

To use analytics:

1. Open **Restaurant Analytics**.
2. Select a date range.
3. Apply/refresh the data.
4. Review sales totals, order volume, hourly closed-order activity, performance breakdowns, and the latest paid bills.

## 7. Kitchen operations

### 7.1 Process kitchen orders

1. Open **Kitchen > Kitchen Orders**.
2. Review pending restaurant orders and package meals.
3. Open an order and start preparation for the relevant quantities.
4. Mark individual items/quantities as preparing or ready using the available controls.
5. When fully prepared, mark them done/completed.
6. Use refresh when new orders are expected.
7. Open **Order History** to review completed cooking activity.

Order History includes date-range summaries, cooked-by-employee, cooked-by-item, the completed item list, and current Kitchen warehouse stock value.

### 7.2 Kitchen stock requests and usage

1. Open **Stock Request & Usage**.
2. On **Request & Assign Items**, create a request for the required raw materials and quantities.
3. Submit the request for inventory approval/fulfilment.
4. After stock is assigned to the Kitchen warehouse/section, open **Mark Stock Usage**.
5. Select the item and enter the used quantity.
6. Save the usage record.

### 7.3 Record kitchen damage or waste

1. Open **Kitchen Stock Usage & Damage**.
2. Select the kitchen section and item.
3. Enter quantity and the usage/damage reason requested by the form.
4. Submit the record.
5. Inventory administrators can later process damaged/spoiled value in **Expired & Damaged**.

### 7.4 Kitchen usage report

1. Open **Kitchen Usage Report**.
2. Choose **All Sections** or a specific kitchen section.
3. Set any available date filters.
4. Refresh.
5. Review the usage records and totals.

### 7.5 Event food requirements

1. Open **Event Food Requirements**.
2. Use **Active** to find an approved event.
3. Select **View Details**.
4. Review event information and the food-requirement table.
5. After all kitchen work is finished, select **Mark Event Complete** and confirm.
6. Completed events appear under **Completed**.

## 8. Inventory and procurement

### 8.1 Recommended inventory setup sequence

1. Create departments/warehouses and designate the main store.
2. Add inventory items and units of measure.
3. Initialize which items belong to each warehouse.
4. Create and approve purchase orders where applicable.
5. Receive stock through GRN.
6. Use MRNs for inter-store requests/transfers.
7. Record usage, damage, expiry, and adjustments.
8. Reconcile through Stock Overview, Transaction Log, and Inventory Reports.

Supported units include kg, g, Ltr, Ml, Nos, Box, Btl, Pkt, Can, Roll, Bundle, Crtn, Tin, Ream, Cylinder, and Card.

### 8.2 Manage stores and departments

1. Open **Inventory > Manage Store**.
2. Add an inventory department/store name.
3. Configure store details and main-store designation where shown.
4. Save.
5. Use the item matrix to initialize which items are held by each store.
6. Remove an initialization or department only after checking stock and dependent transactions.

### 8.3 Add an inventory item

1. Open **Add New Item**.
2. Enter primary identification, item name, SKU/barcode if used, unit of measure, category, reorder/stock details, brand/size, and other displayed fields.
3. Configure warehouse initialization/starting information if the form requests it.
4. Save.
5. Confirm the item appears in the item list.
6. Use the pencil action to correct an item name.

### 8.4 Manage items and direct stock transactions

1. Open **Manage Items**.
2. Use **Inventory List** to search, add, edit, or review items.
3. Use **Warehouse Items** to review quantities by store.
4. Use **Stock In (GRN)** for receiving access.
5. Use **Movement History** to review item movements.
6. For an authorized manual movement, open **Stock Transaction**, choose transaction type, source/destination, quantity, and notes, then save.
7. Use **Create MRN Request** when another store must issue stock rather than using a manual adjustment.

### 8.5 Create an MRN stock request

1. Open **MRN Requests** or the request action in Manage Items.
2. Select requesting and issuing stores/departments as required.
3. Add each item and requested quantity.
4. Add a reason/notes.
5. Submit the request.
6. Monitor its status in request history.

To approve or fulfil an MRN:

1. Open **MRN Approvals**.
2. Find the pending request.
3. Review requested quantities and source stock.
4. Approve, or reject and enter a reason.
5. For an approved request, select **Fulfill Transfer**.
6. Enter actual fulfilled quantities where allowed.
7. Confirm the transfer. The system records stock movement between stores.

### 8.6 Purchase orders

To create a PO:

1. Open **Purchase Orders** and select **Create Purchase Order**.
2. Enter supplier name and delivery notes.
3. Search for an existing inventory item or enter a permitted custom item name.
4. Enter quantity, estimated/unit price, brand, and size/package where relevant.
5. Add all required lines.
6. Review the total and submit.

To approve a PO:

1. Open **PO Approvals**.
2. Use the new/pending tab.
3. Open the PO and review supplier, lines, quantities, pricing, and notes.
4. Approve or reject according to authority.
5. Review processed items in the history/already-processed tab.

To edit or delete, use the row actions in Purchase Orders. Deleting permanently removes the PO and its items.

### 8.7 Receive stock with a GRN

For PO-based receipt:

1. Open **GRN (Stock In)**.
2. Open the **Pending** list and select the approved PO to receive.
3. Enter the received quantity for each item.
4. Enter unit price if known, batch number, brand, size, supplier, expiry information, and discrepancies where requested.
5. Review damaged or missing quantities.
6. Confirm stock intake.
7. Verify the GRN under **Received** or **History** and confirm warehouse stock increased.

For a new/multi-item GRN:

1. Select **New GRN**.
2. Complete the GRN header and supplier/warehouse information.
3. Add each received item, quantity, price, batch, and expiry detail.
4. Review totals and submit.

### 8.8 Record stock usage

1. Open **Stock Usage**.
2. Select warehouse/department and item.
3. Enter the quantity used and purpose/reference.
4. Submit.
5. Confirm the movement in Transaction Log.

### 8.9 Expired and damaged stock

1. Open **Expired & Damaged**.
2. Refresh and locate unprocessed damage/expiry records.
3. Open a record for processing.
4. Verify type, warehouse, item, quantity, batch/expiry, and notes.
5. Enter or confirm the financial value requested.
6. Confirm processing.

### 8.10 Stock overview, transaction log, and reports

**Inventory Stock Overview** offers Card List, Grouped Table, and Cross-Store View. Use search/filter controls to compare total stock across stores and spot low inventory.

**Transaction Log**:

1. Set type, warehouse, item, date, or search filters.
2. Refresh.
3. Open a transaction for full details.
4. Use **Export CSV** for a downloadable reconciliation file.

**Inventory Reports**:

1. Select This Week, This Month, This Year, or a custom period.
2. Review stock received, issued, damaged/spoiled, daily intake versus issue, department consumption, and detailed logs.
3. Open the expired/damaged report for type and warehouse breakdowns.
4. Use **Print** when a paper/PDF copy is required.

## 9. Cash requests, finance, and accounting

### 9.1 Inventory cash request and settlement lifecycle

Requester steps:

1. Open **Inventory > Cash Requests**.
2. Create a request and enter purpose, amount, linked purchasing details, and notes/documents required by the form.
3. Submit and monitor it in **Your Requests**.
4. After approval and cash issue, make the purchase.
5. Open the request and select **Submit Settlement**.
6. Enter actual spending, returned balance or additional amount, supplier/receipt details, and supporting evidence.
7. Submit settlement.

Approver steps:

1. Open **Cash and Credit Approvals**.
2. Use **Pending** to review requests waiting for approval.
3. Approve or reject with the appropriate notes.
4. Use **Additional** for cases where actual spending exceeded the issued amount.
5. Use **History** for completed decisions.
6. Review **Credit Liabilities** for supplier-credit obligations.

Requester and approver pages both include a **Credit Liabilities** tab. Record and clear liabilities according to the displayed payment/settlement options.

### 9.2 Finance Requests

1. Open **Accounting > Finance Requests**.
2. Review daily-worker and other-expense funding requests.
3. Open a request and verify request number, requester, purpose, and amount.
4. Issue the approved amount through **Issue Money**.
5. Record the source/account and notes required by the form.
6. Confirm issue and monitor remaining/settled amounts.

Use **Finance Requests Report** for reporting on these flows.

### 9.3 Inventory Cash

Use **Accounting > Inventory Cash** to process the accounts-side stage of inventory funding. Review approved requests, issue funds against the correct account, and reconcile settlements and returned/additional money.

### 9.4 Chart of accounts and accounting

1. Open **Accounting**.
2. Create or maintain accounts using the name, code, type, opening/current balance, and other displayed settings.
3. Review account transactions and balances.
4. Record authorized income/expense/transfer entries through the relevant dialogs.
5. Select the correct debit/credit or source/destination accounts.
6. Add a reference and description sufficient for audit.
7. Save and verify balances.

Restaurant, services, events, petty cash, and other modules can post or transfer money into configured accounting accounts. Configure destination accounts before operational users begin card or cash processing.

### 9.5 Other expenses

1. Open **Other Expenses**.
2. Maintain expense categories if the needed category does not exist.
3. Select **Add Expense** and enter category, description, amount, date, payment/funding information, links/documents, and notes.
4. Save.
5. Select eligible expenses and **Request Funds** where funding is required.
6. After fully funded and paid, select **Mark Paid**.
7. Edit or delete only before the record becomes locked by payment/accounting status.

### 9.6 Other incomes

1. Open **Other Incomes**.
2. Select **Add Income**.
3. Enter income category/source, description, amount, date, payment method, account details, and notes.
4. Save.
5. Review the record in the income list and accounting destination where applicable.

## 10. Services income

The system has separate income registers for **Laundry**, **Transport & Excursion**, and **Spa & Pool**.

To add a service charge/income record:

1. Open the required service page.
2. Select **Add New Record**.
3. Enter description/service details and amount.
4. Identify an in-house guest by searching, entering/scanning the guest QR pass, or entering room details.
5. Choose the payment/charge method shown by the form.
6. Save.
7. Print the generated invoice if required.

Unpaid records may be edited. Paid records are intentionally protected from editing. Delete only after confirming the record is incorrect.

### 10.1 Services Account

1. Open **Services Account**.
2. Review summary cards and payment transactions.
3. Select the Accounting destination for service card payments and select **Save Card Account**.
4. To transfer physical cash, select **Transfer Cash**.
5. Select the destination account, enter an amount no greater than available cash, add notes, and confirm.
6. Verify the entry in **Cash Transfer History**.

## 11. Event management

### 11.1 Create an event

1. Open **Event Workspace**.
2. Add an event location first if the venue is not available; enter location name, address/area, and capacity.
3. Select **Create Event**.
4. Enter event name/type, location, capacity, start/end date and time, owner name/mobile, and the other owner, company, billing, contact, and notes fields.
5. Ensure end time is after start time.
6. Save. The system prevents overlapping events at the same location.

### 11.2 Build the event workspace

Select the event, then complete each tab:

- **Schedule:** Add title, start/end time, location, and notes.
- **Food:** Add category/item, quantity, unit, unit price, and dietary notes.
- **Activities:** Add activity, time, provider, cost, status, and notes.
- **Payments:** Add payer, amount, payment type/method, date, reference, and notes. Print an invoice/receipt where available.
- **Budget:** Add category, description, income/expense type, estimated amount, actual amount, and status.
- **Workflows:** Add task title, stage, owner, due date, priority, status, notes, and optional automation rule text.

Use the delete action only for an erroneous row. Use status actions to reflect operational progress.

### 11.3 Approve an event

1. Open **Event Approvals**.
2. Select a pending event.
3. Review venue, schedule, owner/contact, capacity, food, budget, payments, and activities.
4. Approve or reject.
5. Approved events become available to downstream operational areas such as Kitchen Event Food Requirements.

### 11.4 Calendar, registrations, budget, payments, and workflows

- **Event Calendar:** Review events by date and open the relevant event.
- **Registration & Booking:** Select an event, add guest name/contact, guest count, amount, and status.
- **Event Budget:** Select an event and add/update budget lines.
- **Event Payments:** Record and review event payments and refunds.
- **Event Workflows:** Assign and update operational tasks.
- **Event Account:** Configure payment accounts, review cash/card transactions, and transfer available event cash to Accounting.

### 11.5 Print event documents

1. Open the event in Event Workspace.
2. Use the print/report action.
3. Allow browser pop-ups if requested.
4. Review the generated event report or payment invoice.
5. Print or save as PDF through the browser.

## 12. HRMS

### 12.1 HRMS Dashboard

1. Open **HRMS Dashboard**.
2. Select daily or monthly view and the required date/month.
3. Review employee attendance/status summaries.
4. Review temporary/daily-worker status separately.
5. Use the detailed HR pages to correct source records; do not treat a dashboard total as the editable record.

### 12.2 Employee Management

1. Open **Employees**.
2. Select **New Employee** to create a record using the same details, payroll, security, and permissions workflow described in User Management.
3. Use **Edit** to update an employee.
4. Open the employee calendar action to review common holidays and personal overrides.
5. Open employee leave details to review or add an authorized leave record.

### 12.3 Job titles and allowance types

To manage job titles:

1. Open **Job Titles**.
2. Add a title and associate it with the appropriate department information.
3. Edit or delete only after checking employee assignments.

To manage allowances:

1. Open **Allowance Types**.
2. Select **New Allowance Type**.
3. Enter name, amount/calculation settings, and active status shown by the form.
4. Save.
5. Assign allowances in an employee's Employment & Payroll tab.

### 12.4 Leave schemes

1. Open **Leave Schemes**.
2. Create a scheme with name/description.
3. Expand the scheme row.
4. Select **Add Leave Type**.
5. Enter leave type, number of days, reset period, and other rules.
6. Repeat for all leave categories.
7. Assign the scheme to employees.

### 12.5 Request leave

1. Open **My Leaves**.
2. Review the current-year balance.
3. Select **Request Leave**.
4. Choose leave type and dates and enter reason/details.
5. Submit.
6. Monitor approval status in **My Leave History**.

If manager approval is configured, the request first goes to the reporting manager and then to final HR/admin approval.

### 12.6 Approve leave

Manager:

1. Open **Manager Leave Approvals**.
2. Review **Pending Team Requests**.
3. Open the request, verify dates, balance, and reason.
4. Approve or reject and confirm.

HR/admin:

1. Open **Leave Approvals**.
2. Use summary cards to filter by status.
3. Review a request.
4. Approve or reject and confirm the action.

### 12.7 Working calendars and holidays

1. Open **Working Calendar**.
2. Create a calendar with name, description, year, and active status.
3. Open the calendar.
4. Select a day to mark a holiday, half day, or other supported day type.
5. Use **Add Holidays** for multiple entries.
6. Use **Import Sri Lanka Public Holidays** to import the year's public holidays, then review before final use.
7. Open **Employee Overrides** to add personal holidays or exceptions for one employee.
8. Assign the calendar to employees.

### 12.8 Attendance

Employee self-service:

1. Open **Attendance**.
2. Select **Clock In** at the start of work.
3. Select **Clock Out** at the end of work.
4. Review **My History**.

Authorized staff:

1. Use **Mark for Employee** to select an employee and date and record/update attendance.
2. Use **Daily Log (Admin)** to review all staff for a selected day.
3. Select **Add Record** or edit an existing record to correct authorized data.

If the page displays **Setup Required**, the attendance database setup/migration must be completed by a technical administrator.

### 12.9 Daily reports

1. Open **Daily Reports**.
2. Select **Submit Daily Report**.
3. Enter the report date, work summary, issues, and other displayed details.
4. Submit.
5. Review prior entries under **Report History**.

### 12.10 Overtime

Employee:

1. Open **My OT Requests**.
2. Select a date and **Submit OT Request**.
3. Enter hours/times and reason.
4. Submit and monitor status.

Manager:

1. Open **Manager OT Approvals**.
2. Review team requests.
3. Approve, or reject with a reason.

Final approver:

1. Open **OT Approvals**.
2. Use **Pending** for requests awaiting final approval.
3. Approve or reject.
4. Use **History** for processed requests.

Administrator configuration:

1. Open **OT Settings**.
2. Under **Global Settings**, select the calculation method, approval flow, and default monthly hours limit. A zero limit means no limit.
3. Under **Per-Employee Limits**, enter overrides where required.
4. Save.

### 12.11 Daily workers

To register and roster workers:

1. Open **Daily Workers**.
2. Under **Manage Workers**, select **Add Worker** and enter identity, department, daily wage, active status, and optional system-access details.
3. Under **Assign Workers by Date**, choose the date and select workers for the roster.
4. Select **Save Daily Roster**.

To mark attendance and pay:

1. Open **Attendance & Pay** and choose the date.
2. Mark each worker's attendance.
3. Verify calculated pay.
4. Request wage money through **Money Requests** if required.
5. At day end, pay individually or use **Pay All** after checking amounts.

### 12.12 Payroll configuration and run

Initial configuration:

1. Ensure employees have salary, allowances, service-charge settings, calendar, attendance, approved leave, and approved OT data.
2. Open **Payroll**.
3. Under **Salary Configuration**, verify employee settings.
4. Under **Pay Period**, configure the period boundaries; use auto-fill where appropriate and save.
5. Configure **APIT Tax Settings** before calculating tax.

Run payroll:

1. Open **Run Payroll**.
2. Select the pay period.
3. Calculate payroll.
4. Review each employee's basic salary, allowances, service charge, OT, deductions, APIT, and net pay.
5. Correct source configuration if values are wrong, then recalculate.
6. Process/finalize payroll only after review.

Use **Payroll Summary** for period totals and per-employee breakdown. Employees use **My Payslips** to open and print their finalized payslips.

### 12.13 APIT settings

1. Open **APIT Tax Settings**.
2. Enter or update the tax bands, thresholds, rates, and effective settings displayed.
3. Save.
4. Recalculate any unfinalized payroll that should use the new settings.

Do not change tax rules without confirmation from authorized payroll/accounting personnel.

### 12.14 Petty cash

Employee request:

1. Open **My Petty Cash**.
2. Select **New Petty Cash Request**.
3. Enter amount, purpose, and details.
4. Submit.
5. After spending, open the request and **Submit Supporting Document** with actual amount and evidence.

Approver:

1. Open **Petty Cash Approvals**.
2. Review the request and approve/reject it.

Accounts:

1. Open **Petty Cash (Accounts)**.
2. Use **Pending Accounts Approval** to perform the accounts review.
3. Use **Ready to Issue** to issue approved cash after checking the daily pool.
4. Use **Balance** to collect underspend or issue approved additional overspend.
5. Use **All Requests** for history.
6. Use **Settings** to configure the daily limit/pool rules.

## 13. Activities, experiences, inquiries, and blogs

### 13.1 Activities and experiences

1. Open **Activities** or **Experiences**.
2. Select the add action.
3. Enter title/name, description, image/media, price, availability, duration, category, or other displayed content fields.
4. Save.
5. Use edit to update published content and delete only when the offering must be removed.

### 13.2 Experience inquiries and general inquiries

1. Open **Experience Inquiries** or **Inquiries**.
2. Review the inquiry list and customer/contact information.
3. Open a record to read the message and requested experience/service.
4. Update its response/status using the available row actions.
5. Use any email/contact link to follow up outside the system when appropriate.

### 13.3 Blog Management

To create a post:

1. Open **Blog Management**.
2. Select **Create Blog**.
3. Enter title, summary/content, image, author/category, publication status, and other displayed fields.
4. Preview if available and save/publish.

To edit, open the row action, update the post, and save. Avoid deleting published content without checking whether public links depend on it.

## 14. Notifications

The dashboard notification menu reports workflow events generated by modules such as inventory requests and approvals. To use it:

1. Select the notification/bell icon in the dashboard header.
2. Open an unread notification.
3. Follow its link to the relevant request or task.
4. Complete the work in the source module.
5. Mark/read notifications as supported by the menu.

Notifications are supporting alerts; the source module remains the authoritative record.

## 15. Reports and exports

Active reporting is distributed across the system:

- Restaurant Analytics
- Inventory Reports and Transaction Log CSV export
- Kitchen Order History and Kitchen Usage Report
- HRMS Dashboard, Daily Reports, Payroll Summary, and Payslips
- Finance Requests Report
- Event printable report and invoices
- Front-desk bills, guest passes, and history
- Buffet booking print/share
- Purchase-order print view

The general **Reports** route currently displays **Under Migration**. Use the specialized reports above until migration is completed.

For printing:

1. Open the report/document.
2. Apply filters first.
3. Select **Print**.
4. If a new window does not appear, allow pop-ups for the site.
5. Use the browser print dialog to print or save as PDF.

## 16. Important end-to-end workflows

### 16.1 Guest stay lifecycle

1. Configure room/chalet, package, rates, and facilities.
2. Create/confirm the booking.
3. Assign a room.
4. Check in and issue the QR guest pass.
5. Add restaurant, laundry, transport, spa/pool, activities, facility, and package-meal activity during the stay.
6. Move eligible charges to the guest bill.
7. Review the complete folio.
8. Settle payment and check out.
9. Retrieve the record later from Front Desk History.

### 16.2 Restaurant order-to-cash lifecycle

1. Configure restaurant warehouse, taxes, sections, menu, and tables.
2. Waiter opens a table and submits the order.
3. Kitchen prepares and completes items.
4. Waiter serves and sends the order to billing.
5. Payment staff settles by cash/card, or charges it to an in-house room.
6. Receipt is produced and table closes.
7. Restaurant Account and Analytics reflect the result.

### 16.3 Purchase-to-stock lifecycle

1. Create an inventory cash/MRN requirement or PO.
2. Obtain approvals.
3. Accounts issues funds when applicable.
4. Supplier delivers goods.
5. Inventory records GRN with quantities, price, batch, expiry, and discrepancies.
6. Warehouse stock increases and transaction history is created.
7. Requesting departments obtain stock through MRN transfer.
8. Usage/damage/expiry is recorded.
9. Finance is settled and inventory reports are reconciled.

### 16.4 Employee-to-payroll lifecycle

1. Create employee and assign role, manager, leave scheme, calendar, salary, allowances, and permissions.
2. Employee records attendance and requests leave/OT as needed.
3. Manager and final approvers process leave/OT.
4. Daily reports and petty-cash evidence are submitted as needed.
5. HR reviews attendance/calendar data.
6. Payroll calculates earnings, approved OT, allowances, service charge, deductions, and APIT.
7. Payroll is reviewed and finalized.
8. Employee views the payslip.

### 16.5 Event lifecycle

1. Create locations and an event without scheduling conflicts.
2. Enter owner/billing details.
3. Build schedule, food, activities, budget, payment, and workflow data.
4. Obtain event approval.
5. Kitchen reviews food requirements.
6. Operational owners update workflow/activity status.
7. Record payments/refunds and transfer cash to Accounting.
8. Mark kitchen/event work complete.
9. Print the final event report/invoices.

## 17. Data-entry and control guidelines

- Fields marked with `*` are mandatory.
- Search for an existing guest, employee, supplier, item, or account before creating a duplicate.
- Use ISO-consistent dates and verify check-in/check-out and event start/end order.
- Enter money in LKR unless the page explicitly states otherwise.
- Confirm the warehouse and unit before saving stock quantities.
- Enter batch and expiry data during receipt, not later, whenever it is available.
- Add meaningful notes to approvals, rejections, adjustments, cash issues, and transfers.
- Do not edit or delete paid, posted, received, finalized, or historically audited records except through an authorized correction process.
- Reconcile physical cash with system available cash before transferring or issuing money.
- Use status changes to represent real work; do not mark an order/event/booking complete prematurely.

## 18. Troubleshooting

### A menu or page is missing

Your role/account lacks access. Ask an administrator to review **Role Permissions** and your personal **Permissions** tab. Restricted administrators also require explicit selections.

### A page shows no records

Check date/status/store filters, clear search text, refresh, and verify that prerequisite records exist. For example, an approved event is required before Kitchen sees event food requirements.

### A room/table/item cannot be selected

It may be occupied, unavailable, in maintenance, uninitialized in that warehouse, out of stock, or blocked by another record. Review its master-data status.

### Event creation reports a conflict

Another event overlaps at the same location. Change the location or start/end time.

### Print or invoice does not open

Allow pop-ups for the application and retry.

### Attendance says Setup Required

A technical administrator must apply the required database setup/migration and then retry the page.

### Totals appear incorrect

Check source records and configuration: prices, quantities, dates, tax/service charge, payment status, salary, allowances, attendance, approved OT/leave, and APIT settings. Refresh or recalculate only after correcting the source.

### A save button remains disabled

Complete all required fields, choose a valid status/account/item, enter a positive amount/quantity, and resolve validation messages. Some actions are intentionally disabled once a record is paid or finalized.

## 19. Feature/route reference

| Area | Main application route(s) |
|---|---|
| Login and app selection | `/`, `/app` |
| Waiter and POS apps | `/app/waiter`, `/app/pos` |
| Home/profile | `/dashboard/home`, `/dashboard/profile` |
| Customers/front desk | `/dashboard/customers`, `/dashboard/front-desk`, `/dashboard/loyalty` |
| Restaurant | `/dashboard`, `/dashboard/billing`, `/dashboard/restaurant-account`, `/dashboard/restaurant-analytics` |
| Restaurant configuration | `/dashboard/menu-management`, `/dashboard/menu-settings`, `/dashboard/table-management`, `/dashboard/restaurant-settings` |
| Rooms/reservations | `/dashboard/room-management`, `/dashboard/reservations`, `/dashboard/bookings` |
| Chalet | `/dashboard/chalet/rooms`, `/dashboard/chalet/rates`, `/dashboard/chalet/bookings` |
| Buffet | `/dashboard/buffet-packages`, `/dashboard/buffet-bookings` |
| Inventory setup/items | `/dashboard/inventory-management/warehouses`, `/dashboard/inventory-management/add-item`, `/dashboard/inventory-management` |
| MRN | `/dashboard/inventory-requests`, `/dashboard/inventory-requests/history` |
| Purchasing/GRN | `/dashboard/purchase-orders`, `/dashboard/purchase-orders/approvals`, `/dashboard/inventory-management/grn` |
| Inventory controls/reports | `/dashboard/inventory-stock-overview`, `/dashboard/inventory-management/stock-usage`, `/dashboard/inventory-management/expired-damaged`, `/dashboard/inventory-management/transaction-log`, `/dashboard/inventory-reports` |
| Inventory finance | `/dashboard/inventory-cash-requests`, `/dashboard/inventory-cash-approvals`, `/dashboard/accounting/inventory-cash` |
| Kitchen | `/dashboard/kitchen/orders`, `/dashboard/kitchen/orders/history`, `/dashboard/kitchen/inventory-requests`, `/dashboard/kitchen/stock-usage`, `/dashboard/kitchen/stock-usage/report`, `/dashboard/kitchen/events` |
| Accounting/finance | `/dashboard/accounting`, `/dashboard/accounting/daily-workers-finance`, `/dashboard/accounting/finance-requests-report` |
| Other income/expense | `/dashboard/expenses`, `/dashboard/other-incomes` |
| Services | `/dashboard/services/laundry`, `/dashboard/services/transport`, `/dashboard/services/spa`, `/dashboard/services/account` |
| Events | `/dashboard/event-management/events`, `/dashboard/event-management/approvals`, `/dashboard/event-management/calendar`, `/dashboard/event-management/registrations`, `/dashboard/event-management/budget`, `/dashboard/event-management/payments`, `/dashboard/event-management/workflows`, `/dashboard/event-management/account` |
| HR employee setup | `/dashboard/hrms/employees`, `/dashboard/hrms/job-titles`, `/dashboard/hrms/allowance-types` |
| Leave/calendar | `/dashboard/hrms/leaves`, `/dashboard/hrms/leave-schemes`, `/dashboard/hrms/leave-approvals`, `/dashboard/hrms/manager-leave-approvals`, `/dashboard/hrms/working-calendar` |
| Attendance/reports | `/dashboard/hrms/attendance`, `/dashboard/hrms/reports`, `/dashboard/hrms/dashboard` |
| OT | `/dashboard/hrms/ot`, `/dashboard/hrms/manager-ot-approvals`, `/dashboard/hrms/ot-approvals`, `/dashboard/hrms/ot-settings` |
| Daily workers | `/dashboard/hrms/daily-workers`, `/dashboard/hrms/daily-workers/requests` |
| Payroll | `/dashboard/hrms/payroll`, `/dashboard/hrms/payroll-summary`, `/dashboard/hrms/payslip`, `/dashboard/hrms/apit-settings` |
| Petty cash | `/dashboard/hrms/petty-cash`, `/dashboard/hrms/petty-cash-approvals`, `/dashboard/hrms/petty-cash-accounts` |
| Roles/users | `/dashboard/settings/roles`, `/dashboard/user-management` |
| Content/inquiries | `/dashboard/activities`, `/dashboard/experiences`, `/dashboard/blogs`, `/dashboard/experience-inquiries`, `/dashboard/inquiries` |

---

## 20. Administrator launch checklist

Before production use, confirm all of the following:

- Users, departments, job titles, reporting managers, and roles are correct.
- Role and personal permissions follow least-privilege access.
- Working calendars, leave schemes, salary, allowances, OT, APIT, and petty-cash limits are configured.
- Accounting chart and destination accounts are configured.
- Restaurant warehouse, sections, taxes, charges, menu, and tables are configured.
- Inventory stores, main-store designation, items, units, and item/store initialization are complete.
- Rooms, chalet rooms, occupancy rates, packages, buffet packages, and booking rules are configured.
- Event locations are configured.
- Staff have tested printing, QR scanning, notifications, and their full assigned workflow.
- Opening balances and stock have been independently checked.
- A backup, audit, and correction procedure is agreed before live transactions begin.
