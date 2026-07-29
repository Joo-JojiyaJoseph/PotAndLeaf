<?php

namespace Database\Seeders;

use App\Models\Company;
use Illuminate\Database\Seeder;

class CompanySeeder extends Seeder
{
    public function run(): void
    {
        $companies = [
            ['code' => 'CHK-HO',  'name' => 'Cheerakuzhy Nurseries (HO)', 'legal_name' => 'Cheerakuzhy Group', 'state' => 'Kerala', 'state_code' => '32'],
            ['code' => 'CHK-CLT', 'name' => 'Cheerakuzhy Calicut',        'state' => 'Kerala', 'state_code' => '32'],
            ['code' => 'CHK-TSR', 'name' => 'Cheerakuzhy Thrissur',       'state' => 'Kerala', 'state_code' => '32'],
            ['code' => 'CHK-PKD', 'name' => 'Cheerakuzhy Palakkad',       'state' => 'Kerala', 'state_code' => '32'],
        ];

        foreach ($companies as $data) {
            Company::firstOrCreate(['code' => $data['code']], $data + ['is_active' => true]);
        }
    }
}
