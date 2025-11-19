import { Command, CommandRunner } from 'nest-commander';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

interface ModelData {
  name: string;
  description?: string;
  year_from?: number;
  year_to?: number;
}

interface BrandData {
  name: string;
  country_of_origin: string;
  description: string;
  models: ModelData[];
}

@Injectable()
@Command({
  name: 'seed:brands',
  description: 'Seed motorcycle brands and models',
})
export class SeedBrandsCommand extends CommandRunner {
  private readonly brandsData: BrandData[] = [
    {
      name: 'Honda',
      country_of_origin: 'Japan',
      description: 'World\'s largest motorcycle manufacturer, known for reliability and innovation in big bikes',
      models: [
        { name: 'CB500F', description: 'Middleweight naked bike', year_from: 2013 },
        { name: 'CB500X', description: 'Adventure bike', year_from: 2013 },
        { name: 'CBR500R', description: 'Sport bike', year_from: 2013 },
        { name: 'CB650R', description: 'Naked sport bike', year_from: 2019 },
        { name: 'CBR650R', description: 'Sport bike', year_from: 2019 },
        { name: 'CB650F', description: 'Sport naked bike', year_from: 2014, year_to: 2018 },
        { name: 'Africa Twin CRF1000L', description: 'Adventure touring bike', year_from: 2016 },
        { name: 'Africa Twin CRF1100L', description: 'Adventure touring bike', year_from: 2020 },
        { name: 'Rebel 500', description: 'Cruiser bike', year_from: 2017 },
        { name: 'Rebel 1100', description: 'Cruiser bike', year_from: 2021 },
        { name: 'NC750X', description: 'Adventure tourer', year_from: 2014 },
        { name: 'CB1000R', description: 'Super naked bike', year_from: 2018 },
        { name: 'CBR1000RR', description: 'Superbike', year_from: 2004 },
        { name: 'CBR1000RR-R Fireblade', description: 'Racing superbike', year_from: 2020 },
        { name: 'Gold Wing', description: 'Luxury touring bike', year_from: 1975 },
        { name: 'VFR800F', description: 'Sport touring bike', year_from: 2014 },
      ],
    },
    {
      name: 'Kawasaki',
      country_of_origin: 'Japan',
      description: 'Japanese manufacturer known for high-performance big bikes',
      models: [
        { name: 'Ninja 400', description: 'Sport bike', year_from: 2018 },
        { name: 'Ninja 650', description: 'Sport bike', year_from: 2006 },
        { name: 'Z400', description: 'Naked sport bike', year_from: 2019 },
        { name: 'Z650', description: 'Naked sport bike', year_from: 2017 },
        { name: 'Z900', description: 'Naked sport bike', year_from: 2017 },
        { name: 'Z900RS', description: 'Retro naked bike', year_from: 2018 },
        { name: 'Versys 650', description: 'Adventure touring bike', year_from: 2007 },
        { name: 'Versys 1000', description: 'Adventure touring bike', year_from: 2012 },
        { name: 'Ninja 1000SX', description: 'Sport touring bike', year_from: 2020 },
        { name: 'Ninja ZX-6R', description: 'Supersport bike', year_from: 1995 },
        { name: 'Ninja ZX-10R', description: 'Superbike', year_from: 2004 },
        { name: 'Ninja H2', description: 'Supercharged hyperbike', year_from: 2015 },
        { name: 'Ninja H2 SX', description: 'Supercharged sport tourer', year_from: 2018 },
        { name: 'Z H2', description: 'Supercharged naked bike', year_from: 2020 },
        { name: 'Vulcan S', description: 'Cruiser bike', year_from: 2015 },
      ],
    },
    {
      name: 'BMW',
      country_of_origin: 'Germany',
      description: 'German manufacturer known for premium touring and adventure motorcycles',
      models: [
        { name: 'G 310 R', description: 'Entry naked bike', year_from: 2016 },
        { name: 'G 310 GS', description: 'Entry adventure bike', year_from: 2017 },
        { name: 'F 750 GS', description: 'Middleweight adventure bike', year_from: 2018 },
        { name: 'F 850 GS', description: 'Middleweight adventure bike', year_from: 2018 },
        { name: 'F 900 R', description: 'Middleweight naked bike', year_from: 2020 },
        { name: 'F 900 XR', description: 'Sport adventure bike', year_from: 2020 },
        { name: 'S 1000 R', description: 'Super naked bike', year_from: 2014 },
        { name: 'S 1000 RR', description: 'Superbike', year_from: 2009 },
        { name: 'S 1000 XR', description: 'Adventure sport bike', year_from: 2015 },
        { name: 'R 1250 GS', description: 'Adventure touring bike', year_from: 2019 },
        { name: 'R 1250 GS Adventure', description: 'Long-range adventure bike', year_from: 2019 },
        { name: 'R 1250 RT', description: 'Sport touring bike', year_from: 2019 },
        { name: 'R 1250 R', description: 'Sport roadster', year_from: 2019 },
        { name: 'R 18', description: 'Cruiser bike', year_from: 2020 },
        { name: 'K 1600 GT', description: 'Sport touring bike', year_from: 2011 },
        { name: 'K 1600 GTL', description: 'Luxury touring bike', year_from: 2011 },
        { name: 'K 1600 B', description: 'Bagger touring bike', year_from: 2017 },
        { name: 'R nineT', description: 'Heritage roadster', year_from: 2014 },
        { name: 'R nineT Scrambler', description: 'Heritage scrambler', year_from: 2016 },
      ],
    },
    {
      name: 'Ducati',
      country_of_origin: 'Italy',
      description: 'Italian manufacturer renowned for high-performance sport bikes and V-twin engines',
      models: [
        { name: 'Monster 797', description: 'Naked sport bike', year_from: 2017, year_to: 2020 },
        { name: 'Monster 821', description: 'Naked sport bike', year_from: 2014, year_to: 2020 },
        { name: 'Monster 1200', description: 'Naked sport bike', year_from: 2014, year_to: 2020 },
        { name: 'Monster', description: 'New generation naked bike', year_from: 2021 },
        { name: 'Monster SP', description: 'Sport performance naked', year_from: 2023 },
        { name: 'Scrambler Icon', description: 'Retro scrambler', year_from: 2015 },
        { name: 'Scrambler Desert Sled', description: 'Off-road scrambler', year_from: 2017 },
        { name: 'Scrambler 1100', description: 'Big scrambler', year_from: 2018 },
        { name: 'SuperSport 950', description: 'Sport bike', year_from: 2021 },
        { name: 'Streetfighter V2', description: 'Naked sport bike', year_from: 2022 },
        { name: 'Streetfighter V4', description: 'Naked superbike', year_from: 2020 },
        { name: 'Multistrada 950', description: 'Adventure touring bike', year_from: 2017 },
        { name: 'Multistrada V2', description: 'Sport adventure bike', year_from: 2022 },
        { name: 'Multistrada V4', description: 'Adventure touring bike', year_from: 2021 },
        { name: 'Panigale V2', description: 'Superbike', year_from: 2020 },
        { name: 'Panigale V4', description: 'Superbike', year_from: 2018 },
        { name: 'Panigale V4 R', description: 'Racing superbike', year_from: 2019 },
        { name: 'Diavel 1260', description: 'Power cruiser', year_from: 2019 },
        { name: 'Diavel V4', description: 'V4 power cruiser', year_from: 2023 },
        { name: 'XDiavel', description: 'Cruiser bike', year_from: 2016 },
      ],
    },
    {
      name: 'Triumph',
      country_of_origin: 'United Kingdom',
      description: 'British manufacturer blending classic styling with modern performance',
      models: [
        { name: 'Street Twin', description: 'Modern classic', year_from: 2016 },
        { name: 'Street Scrambler', description: 'Modern classic scrambler', year_from: 2017 },
        { name: 'Bonneville T100', description: 'Classic bike', year_from: 2017 },
        { name: 'Bonneville T120', description: 'Classic bike', year_from: 2016 },
        { name: 'Bonneville Bobber', description: 'Bobber style cruiser', year_from: 2017 },
        { name: 'Speedmaster', description: 'Cruiser bike', year_from: 2018 },
        { name: 'Thruxton 1200', description: 'Cafe racer', year_from: 2016 },
        { name: 'Speed Twin', description: 'Modern classic roadster', year_from: 2019 },
        { name: 'Scrambler 1200', description: 'Adventure scrambler', year_from: 2019 },
        { name: 'Street Triple', description: 'Naked sport bike', year_from: 2007 },
        { name: 'Street Triple R', description: 'Performance naked bike', year_from: 2017 },
        { name: 'Street Triple RS', description: 'Premium naked bike', year_from: 2017 },
        { name: 'Speed Triple 1200 RS', description: 'Super naked bike', year_from: 2021 },
        { name: 'Trident 660', description: 'Middleweight roadster', year_from: 2021 },
        { name: 'Tiger 900', description: 'Adventure bike', year_from: 2020 },
        { name: 'Tiger 1200', description: 'Adventure touring bike', year_from: 2022 },
        { name: 'Tiger Sport 660', description: 'Sport adventure bike', year_from: 2022 },
        { name: 'Rocket 3', description: 'Power cruiser', year_from: 2019 },
        { name: 'Daytona Moto2 765', description: 'Limited edition sport bike', year_from: 2020 },
      ],
    },
    {
      name: 'Harley-Davidson',
      country_of_origin: 'United States',
      description: 'American icon known for heavyweight cruisers and V-twin engines',
      models: [
        { name: 'Street 750', description: 'Entry cruiser', year_from: 2014, year_to: 2020 },
        { name: 'Street Rod 750', description: 'Performance cruiser', year_from: 2017, year_to: 2020 },
        { name: 'Iron 883', description: 'Sportster cruiser', year_from: 2009 },
        { name: 'Iron 1200', description: 'Sportster cruiser', year_from: 2018 },
        { name: 'Forty-Eight', description: 'Sportster cruiser', year_from: 2010 },
        { name: 'Sportster S', description: 'Performance cruiser', year_from: 2021 },
        { name: 'Nightster', description: 'Middleweight cruiser', year_from: 2022 },
        { name: 'Street Bob', description: 'Softail cruiser', year_from: 2018 },
        { name: 'Low Rider', description: 'Softail cruiser', year_from: 2018 },
        { name: 'Low Rider S', description: 'Performance cruiser', year_from: 2020 },
        { name: 'Fat Boy', description: 'Softail cruiser', year_from: 1990 },
        { name: 'Fat Bob', description: 'Softail cruiser', year_from: 2018 },
        { name: 'Breakout', description: 'Softail custom', year_from: 2018 },
        { name: 'Heritage Classic', description: 'Softail touring', year_from: 2018 },
        { name: 'Softail Slim', description: 'Bobber style cruiser', year_from: 2018 },
        { name: 'Sport Glide', description: 'Softail bagger', year_from: 2018 },
        { name: 'Road King', description: 'Touring bike', year_from: 1994 },
        { name: 'Street Glide', description: 'Touring bike', year_from: 2006 },
        { name: 'Road Glide', description: 'Touring bike', year_from: 1998 },
        { name: 'Electra Glide', description: 'Touring bike', year_from: 1965 },
        { name: 'Ultra Limited', description: 'Luxury touring bike', year_from: 2011 },
        { name: 'CVO Street Glide', description: 'Custom touring bike', year_from: 2010 },
        { name: 'CVO Road Glide', description: 'Custom touring bike', year_from: 2015 },
        { name: 'Pan America 1250', description: 'Adventure bike', year_from: 2021 },
        { name: 'LiveWire', description: 'Electric motorcycle', year_from: 2019 },
      ],
    },
  ];

  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async run(): Promise<void> {
    console.log('🌱 Starting to seed brands and models...\n');

    try {
      // Start transaction
      await this.prisma.$transaction(async (tx) => {
        let totalBrands = 0;
        let totalModels = 0;

        for (const brandData of this.brandsData) {
          console.log(`📦 Creating brand: ${brandData.name} (${brandData.country_of_origin})`);

          // Check if brand already exists
          const existingBrand = await tx.brands.findFirst({
            where: { name: brandData.name },
          });

          let brand;
          if (existingBrand) {
            console.log(`   ⚠️  Brand already exists, updating...`);
            brand = await tx.brands.update({
              where: { id: existingBrand.id },
              data: {
                country_of_origin: brandData.country_of_origin,
                description: brandData.description,
                is_active: true,
              },
            });
          } else {
            brand = await tx.brands.create({
              data: {
                name: brandData.name,
                country_of_origin: brandData.country_of_origin,
                description: brandData.description,
                is_active: true,
              },
            });
            totalBrands++;
          }

          // Create models for this brand
          console.log(`   📋 Creating ${brandData.models.length} models...`);
          for (const modelData of brandData.models) {
            // Check if model already exists
            const existingModel = await tx.models.findFirst({
              where: {
                brand_id: brand.id,
                name: modelData.name,
              },
            });

            if (existingModel) {
              await tx.models.update({
                where: { id: existingModel.id },
                data: {
                  description: modelData.description,
                  year_from: modelData.year_from,
                  year_to: modelData.year_to,
                  is_active: true,
                },
              });
            } else {
              await tx.models.create({
                data: {
                  brand_id: brand.id,
                  name: modelData.name,
                  description: modelData.description,
                  year_from: modelData.year_from,
                  year_to: modelData.year_to,
                  is_active: true,
                },
              });
              totalModels++;
            }
          }

          console.log(`   ✅ Completed ${brandData.name}\n`);
        }

        console.log('✨ Seeding completed successfully!\n');
        console.log(`📊 Summary:`);
        console.log(`   - Brands created: ${totalBrands}`);
        console.log(`   - Models created: ${totalModels}`);
        console.log(`   - Total brands in database: ${this.brandsData.length}`);
        console.log(`   - Total models in database: ${this.brandsData.reduce((sum, b) => sum + b.models.length, 0)}`);
      });
    } catch (error) {
      console.error('❌ Error seeding brands and models:', error instanceof Error ? error.message : error);
      throw error;
    }
  }
}
