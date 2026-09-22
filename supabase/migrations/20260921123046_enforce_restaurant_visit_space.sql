-- A visit must belong to the same space as its restaurant.

alter table public.restaurants
add constraint restaurants_id_space_id_unique
unique (id, space_id);

alter table public.restaurant_visits
drop constraint if exists restaurant_visits_restaurant_id_fkey;

alter table public.restaurant_visits
add constraint restaurant_visits_restaurant_space_fkey
foreign key (
  restaurant_id,
  space_id
)
references public.restaurants (
  id,
  space_id
)
on delete cascade;
