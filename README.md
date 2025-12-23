# Requirement

- Postgresql (Ex: liman-db podu'u )

# Init

```
### Creating database
## psql -U <username> -c "CREATE DATABASE <dbname>"
root@db-222222222-1111:/# psql -U liman -c "CREATE DATABASE configuration"

### Creating Tables
root@db-222222222-1111:/# psql -U liman configuration
configuration=# CREATE TABLE public.configuration_items (
    id text NOT NULL,
    description character varying,
    dev_version character varying,
    test_version character varying,
	updated_at character NULL,
	created_at character NULL
);

configuration=# CREATE TABLE public.monitoring_services (
    id text NOT NULL,
    title character varying,
    content character varying,
    url character varying,
    tag character varying,
    priority integer,
	updated_at character NULL,
	created_at character NULL

);
configuration=# ALTER TABLE public.monitoring_services ADD created_at timestamptz NULL;
configuration=# ALTER TABLE public.monitoring_services ADD updated_at timestamptz NULL;
```

# Keycloak Permissions

- mya_monitoring_services
- mya_configuration_items
- mya_dps_management
