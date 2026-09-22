alter table public.restaurants
drop constraint if exists restaurants_price_level_check;

alter table public.restaurants
add constraint restaurants_price_level_check
check (
  price_level is null
  or price_level between 1 and 5
);
