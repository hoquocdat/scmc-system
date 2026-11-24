# customers/customer-groups Specification

## Purpose

Groups customers (wholesale, VIP, partner workshops, …) so price books, and later promotions, can target them.

## Requirements

### Requirement: Customer groups
The system SHALL keep customer groups with a unique code, a name, a description and an active flag. A customer SHALL be able to belong to any number of groups. Inactive groups SHALL not make price books apply.

#### Scenario: Create a group
- **WHEN** a manager creates group "Wholesale"
- **THEN** it is listed with 0 members

#### Scenario: Inactive group
- **WHEN** group "VIP" is deactivated
- **THEN** price books targeting only "VIP" no longer apply to its members

### Requirement: Membership
Staff SHALL be able to set a customer's groups on the customer form and filter the customer list by group.

#### Scenario: Assign groups
- **WHEN** a store manager puts customer Nguyễn Văn A in "Wholesale" and "Partner workshop"
- **THEN** the customer shows both groups and appears in the list filtered by either group

### Requirement: Customer group permissions
Reading groups SHALL require `customer_groups:read`; creating, updating and deleting groups SHALL require `customer_groups:create`, `customer_groups:update` and `customer_groups:delete`. A group with members or used by a price book SHALL NOT be deleted; it can be deactivated.

#### Scenario: Group in use
- **WHEN** a manager deletes "Wholesale" which "Giá sỉ" targets
- **THEN** the deletion is refused
